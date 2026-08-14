import { query } from '../../db/supabaseClient.js';
import type { RetrievalHit } from '../../types.js';

/**
 * pgvector cosine-similarity search (<=>) over the HNSW cosine index.
 * cosine distance is in [0, 2]; similarity = 1 - distance.
 */
export async function searchChunks(
  questionVector: number[],
  documentIds: string[],
  limit: number,
): Promise<RetrievalHit[]> {
  const literal = `[${questionVector.join(',')}]`;
  const { rows } = await query<RetrievalHit>(
    `select c.id,
            c.document_id as "documentId",
            c.content,
            c.page_number as "pageNumber",
            c.chunk_index as "chunkIndex",
            c.token_count as "tokenCount",
            1 - (c.embedding <=> $1::vector) as similarity
     from chunks c
     where c.document_id = any($2::uuid[])
     order by c.embedding <=> $1::vector
     limit $3`,
    [literal, documentIds, limit],
  );
  return rows;
}