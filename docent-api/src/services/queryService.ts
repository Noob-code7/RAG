import { performance } from 'node:perf_hooks';
import { config } from '../config.js';
import { query } from '../db/supabaseClient.js';
import { embedTexts } from './embeddings/embeddingClient.js';
import { searchChunks } from './retrieval/vectorSearch.js';
import { deriveConfidence, logRetrieval, rerank } from './retrieval/rerank.js';
import {
  buildPrompt,
  buildSources,
  extractCitedLabels,
  NO_EVIDENCE_MESSAGE,
} from './generation/promptBuilder.js';
import { createChatProvider } from './generation/generationClient.js';
import {
  costOfEmbeddings,
  costOfGeneration,
  estimateTokens,
  logCost,
  logTiming,
} from './observability/metrics.js';
import type { QueryResponse } from '../types.js';

export interface RunQueryInput {
  question: string;
  documentIds: string[];
  notebookId?: string;
}

/**
 * Retrieval + grounded-generation pipeline. Shared by the legacy /query route
 * and the notebook-scoped chat endpoint (POST /notebooks/:id/query), which
 * additionally persists the exchange. Pure in the sense that it never touches
 * the HTTP response — it returns the QueryResponse payload.
 */
export async function runQuery(input: RunQueryInput): Promise<QueryResponse> {
  const { question, documentIds, notebookId } = input;

  // Data isolation (Phase 6): retrieval scope is explicitly restricted to
  // documents that actually exist AND are fully indexed. Chunks belonging to
  // processing, failed, or non-existent documents can never enter scope, so
  // one session's uploads cannot leak into another session's answers. When a
  // notebook_id is supplied, scope is further restricted to that notebook.
  const scopeResult = await query<{ id: string }>(
    notebookId
      ? `select id from documents where id = any($1::uuid[]) and status = 'ready' and notebook_id = $2`
      : `select id from documents where id = any($1::uuid[]) and status = 'ready'`,
    notebookId ? [documentIds, notebookId] : [documentIds],
  );
  const scopedIds = scopeResult.rows.map((r) => r.id);
  console.log(`[query] scope=${scopedIds.length}/${documentIds.length} documents ready`);

  if (scopedIds.length === 0) {
    return { answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval: [] };
  }

  const questionTokens = estimateTokens(question);
  const embeddingCost = costOfEmbeddings(questionTokens);

  const t0 = performance.now();

  // 1. Embed the question with the same model used at ingestion time.
  const [questionVector] = await embedTexts([question]);
  const t1 = performance.now();

  // 2. Candidate retrieval: top-K cosine-similarity chunks within the scope.
  const candidates = await searchChunks(questionVector, scopedIds, config.retrievalTopK);
  const { all, selected } = rerank(candidates, config.rerankTopN);
  logRetrieval(question, all, new Set(selected.map((c) => c.id)));
  const t2 = performance.now();

  const retrieval = selected.map((c, i) => ({
    source_label: `[Source ${i + 1}]`,
    page_number: c.pageNumber,
    similarity: c.similarity,
    snippet: c.content.replace(/\s+/g, ' ').slice(0, 160),
  }));

  // No evidence at all — refuse before ever calling the model.
  if (selected.length === 0) {
    logTiming('embed', t0, t1);
    logTiming('retrieve', t1, t2);
    logTiming('query.total', t0);
    logCost('query.embedding', embeddingCost);
    return { answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval };
  }

  const topSimilarity = selected[0].similarity;

  // 3. Hard guardrail: if even the best chunk is clearly unrelated, refuse
  //    without calling the model. This guarantees no fabricated answer for
  //    out-of-scope questions (grounding correctness > confident speed).
  if (topSimilarity < config.embeddingSimLow) {
    logTiming('embed', t0, t1);
    logTiming('retrieve', t1, t2);
    logTiming('query.total', t0);
    logCost('query.embedding', embeddingCost);
    return { answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval };
  }

  // 4. Grounded generation from the top-N sources with explicit labels.
  const provider = createChatProvider();
  const sources = buildSources(selected);
  const result = await provider.complete(buildPrompt(question, sources.join('\n\n')));
  const t3 = performance.now();

  const answerText = result.content;

  // 5. Attribute citations: map the labels the model actually cited back to
  //    their source chunks.
  const labelToChunk = new Map(selected.map((c, i) => [i + 1, c]));
  const citations = extractCitedLabels(answerText)
    .filter((n) => labelToChunk.has(n))
    .map((n) => {
      const c = labelToChunk.get(n)!;
      return {
        source_label: `[Source ${n}]`,
        document_id: c.documentId,
        page_number: c.pageNumber,
        chunk_content_snippet: c.content.slice(0, 200),
      };
    });

  const confidence = deriveConfidence(
    topSimilarity,
    citations.length,
    config.embeddingSimLow,
    config.embeddingSimHigh,
  );

  // Per-stage latency + cost visibility (Phase 6).
  logTiming('embed', t0, t1);
  logTiming('retrieve', t1, t2);
  logTiming('generate', t2, t3);
  logTiming('query.total', t0);
  const generationCost = costOfGeneration(result.usage.inputTokens, result.usage.outputTokens);
  logCost('query.embedding', embeddingCost);
  logCost(
    `query.generation (${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens)`,
    generationCost,
  );
  logCost('query.total', embeddingCost + generationCost);

  return { answer: answerText, citations, confidence, retrieval };
}