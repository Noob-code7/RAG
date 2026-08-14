import { query } from '../../db/supabaseClient.js';
import { uploadDocumentFile } from '../../db/storage.js';
import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';
import { extractPdfPages, hasExtractableText } from './pdfExtractor.js';
import { chunkPages } from './chunker.js';
import { embedTexts } from '../embeddings/embeddingClient.js';
import { costOfEmbeddings, logCost } from '../observability/metrics.js';

const EMBED_BATCH_SIZE = 10;

export async function createDocumentRecord(filename: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into documents (filename, status) values ($1, 'processing') returning id`,
    [filename],
  );
  return rows[0].id;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Full ingestion pipeline for one document:
 *   storage upload -> page-by-page text extraction -> recursive chunking with
 *   overlap -> per-chunk embeddings -> chunk rows. The document row is updated
 *   as progress is made so the frontend can poll GET /documents/:id/status.
 * Any failure marks the document as failed rather than leaving it stuck.
 */
export async function uploadAndIngest(docId: string, fileBuffer: Buffer): Promise<void> {
  const t0 = performance.now();
  try {
    const storagePath = await uploadDocumentFile(docId, fileBuffer);
    await query(`update documents set storage_path = $2 where id = $1`, [docId, storagePath]);

    const pages = await extractPdfPages(fileBuffer);
    await query(`update documents set page_count = $2 where id = $1`, [docId, pages.length]);

    // Guard against "silent empty indexing": a scanned or image-only PDF has no
    // extractable text layer, which would otherwise yield zero chunks and be
    // marked ready with nothing to retrieve from.
    if (!hasExtractableText(pages, config.minCharsPerPage)) {
      throw new Error(
        'This PDF appears to be a scanned image with no extractable text. ' +
          'Upload a text-based PDF, or run OCR on the file first before uploading.',
      );
    }

    const chunks = chunkPages(
      pages.map((p) => p.text),
      config.chunkTokens,
      config.overlapTokens,
    );
    const total = chunks.length;
    let inserted = 0;
    const embeddedTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await embedTexts(batch.map((c) => c.content));
      for (let k = 0; k < batch.length; k++) {
        const chunk = batch[k];
        await query(
          `insert into chunks (document_id, content, page_number, chunk_index, embedding, token_count)
           values ($1, $2, $3, $4, $5::vector, $6)`,
          [
            docId,
            chunk.content,
            chunk.pageNumber,
            chunk.chunkIndex,
            toVectorLiteral(vectors[k]),
            chunk.tokenCount,
          ],
        );
        inserted += 1;
      }
      await query(`update documents set progress = $2 where id = $1`, [docId, inserted / total]);
    }

    await query(`update documents set status = 'ready', progress = 1 where id = $1`, [docId]);
    console.log(
      `Document ${docId} ingested: ${total} chunks across ${pages.length} pages in ${(performance.now() - t0).toFixed(0)}ms`,
    );
    logCost(`ingestion.embedding (${embeddedTokens} tokens)`, costOfEmbeddings(embeddedTokens));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(`update documents set status = 'failed', error = $2 where id = $1`, [docId, message]);
    console.error(`Ingestion failed for document ${docId}: ${message}`);
    throw err;
  }
}