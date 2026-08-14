import type { Confidence, RetrievalHit } from '../../types.js';

/**
 * Re-ranking step. Phase 2 uses a trivial similarity re-rank (take the top N of
 * the candidates); a later phase can swap this for a cross-encoder that can
 * promote a chunk which is semantically on-target but numerically farther out.
 * Candidates come pre-sorted by similarity, so this is just a slice, but keeping
 * it a distinct step makes the pipeline inspectable.
 */
export function rerank(
  candidates: RetrievalHit[],
  topN: number,
): { all: RetrievalHit[]; selected: RetrievalHit[] } {
  const all = [...candidates].sort((a, b) => b.similarity - a.similarity);
  return { all, selected: all.slice(0, topN) };
}

export function deriveConfidence(
  topSimilarity: number,
  citedCount: number,
  lowThreshold: number,
  highThreshold: number,
): Confidence {
  if (topSimilarity < lowThreshold) return 'not_found';
  if (topSimilarity >= highThreshold && citedCount > 0) return 'grounded';
  if (topSimilarity >= highThreshold) return 'partial';
  if (citedCount > 0) return 'partial';
  return 'not_found';
}

export function logRetrieval(question: string, all: RetrievalHit[], selectedIds: Set<string>): void {
  console.log(`\n[retrieval] question: "${question}"`);
  console.log('[retrieval] candidates (mark = re-ranked into prompt):');
  for (let i = 0; i < all.length; i++) {
    const h = all[i];
    const mark = selectedIds.has(h.id) ? '>>' : '  ';
    const preview = h.content.replace(/\s+/g, ' ').slice(0, 60);
    console.log(
      `${mark} #${i + 1}  sim=${h.similarity.toFixed(4)}  page=${h.pageNumber}  doc=${h.documentId.slice(0, 8)}  "${preview}"`,
    );
  }
}