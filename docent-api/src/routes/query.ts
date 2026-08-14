import { Router } from 'express';
import { performance } from 'node:perf_hooks';
import { config } from '../config.js';
import { query } from '../db/supabaseClient.js';
import { embedTexts } from '../services/embeddings/embeddingClient.js';
import { searchChunks } from '../services/retrieval/vectorSearch.js';
import { deriveConfidence, logRetrieval, rerank } from '../services/retrieval/rerank.js';
import {
  buildPrompt,
  buildSources,
  extractCitedLabels,
  NO_EVIDENCE_MESSAGE,
} from '../services/generation/promptBuilder.js';
import { createChatProvider } from '../services/generation/generationClient.js';
import {
  costOfEmbeddings,
  costOfGeneration,
  estimateTokens,
  logCost,
  logTiming,
} from '../services/observability/metrics.js';
import type { QueryResponse } from '../types.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { question?: unknown; document_ids?: unknown };
    if (typeof body.question !== 'string' || body.question.trim().length === 0) {
      return res.status(400).json({ error: 'question is required and must be a non-empty string' });
    }
    if (
      !Array.isArray(body.document_ids) ||
      body.document_ids.length === 0 ||
      body.document_ids.some((x) => typeof x !== 'string')
    ) {
      return res.status(400).json({ error: 'document_ids must be a non-empty array of strings' });
    }
    const question = body.question.trim();
    const documentIds = body.document_ids as string[];

    // Data isolation (Phase 6): retrieval scope is explicitly restricted to
    // documents that actually exist AND are fully indexed. Chunks belonging to
    // processing, failed, or non-existent documents can never enter scope, so
    // one session's uploads cannot leak into another session's answers.
    const scopeResult = await query<{ id: string }>(
      `select id from documents where id = any($1::uuid[]) and status = 'ready'`,
      [documentIds],
    );
    const scopedIds = scopeResult.rows.map((r) => r.id);
    console.log(`[query] scope=${scopedIds.length}/${documentIds.length} documents ready`);

    const respond = (payload: QueryResponse) => res.json(payload);
    if (scopedIds.length === 0) {
      return respond({ answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval: [] });
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
      return respond({ answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval });
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
      return respond({ answer: NO_EVIDENCE_MESSAGE, citations: [], confidence: 'not_found', retrieval });
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

    respond({ answer: answerText, citations, confidence, retrieval });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Query failed' });
  }
});

export default router;