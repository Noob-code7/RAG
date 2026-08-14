import { performance } from 'node:perf_hooks';
import { encode } from 'gpt-tokenizer';
import { config } from '../../config.js';

/**
 * Approximate token count for a text using the same gpt-tokenizer used at
 * chunking time. This is the basis for embedding-cost estimates, since the
 * embeddings API bills on tokens.
 */
export function estimateTokens(text: string): number {
  return encode(text).length;
}

export function costOfEmbeddings(tokenCount: number): number {
  return (tokenCount / 1_000_000) * config.embeddingPricePerMToken;
}

export function costOfGeneration(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * config.generationInputPricePerMToken +
    (outputTokens / 1_000_000) * config.generationOutputPricePerMToken
  );
}

export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00000';
  if (usd < 0.00001) return '<$0.00001';
  return `$${usd.toFixed(5)}`;
}

/** Log a stage duration and return the measured milliseconds. */
export function logTiming(label: string, startMs: number, endMs: number = performance.now()): number {
  const ms = endMs - startMs;
  console.log(`[timing] ${label}: ${ms.toFixed(1)}ms`);
  return ms;
}

export function logCost(label: string, usd: number): void {
  console.log(`[cost] ${label}: ${formatUsd(usd)}`);
}