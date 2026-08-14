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

/**
 * Topic-coverage retrieval for study artifacts (flashcards/quizzes). Instead of
 * ranking the whole scope against one question and keeping the top few chunks,
 * it asks each document separately for its most topic-relevant chunks. This
 * guarantees a wider spread across the selected documents — coverage for
 * generating many cards, not answer-precision for a single query.
 */
export async function searchChunksByTopic(
  questionVector: number[],
  documentIds: string[],
  perDocument: number,
): Promise<RetrievalHit[]> {
  const literal = `[${questionVector.join(',')}]`;
  const all: RetrievalHit[] = [];
  for (const documentId of documentIds) {
    const { rows } = await query<RetrievalHit>(
      `select c.id,
              c.document_id as "documentId",
              c.content,
              c.page_number as "pageNumber",
              c.chunk_index as "chunkIndex",
              c.token_count as "tokenCount",
              1 - (c.embedding <=> $1::vector) as similarity
       from chunks c
       where c.document_id = $2::uuid
       order by c.embedding <=> $1::vector
       limit $3`,
      [literal, documentId, perDocument],
    );
    all.push(...rows);
  }
  return all;
}

/**
 * Positional coverage sampling for study artifacts when no topic is given:
 * returns evenly-read chunks per document ordered by page, so a flashcard set
 * covers the whole document rather than concentrating on one passage.
 */
export async function sampleChunksByPosition(
  documentIds: string[],
  perDocument: number,
): Promise<RetrievalHit[]> {
  const all: RetrievalHit[] = [];
  for (const documentId of documentIds) {
    const { rows } = await query<RetrievalHit>(
      `select c.id,
              c.document_id as "documentId",
              c.content,
              c.page_number as "pageNumber",
              c.chunk_index as "chunkIndex",
              c.token_count as "tokenCount",
              0 as similarity
       from chunks c
       where c.document_id = $1::uuid
       order by c.page_number asc, c.chunk_index asc
       limit $2`,
      [documentId, perDocument],
    );
    all.push(...rows);
  }
  return all;
}