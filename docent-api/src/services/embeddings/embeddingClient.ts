import OpenAI from 'openai';
import { config } from '../../config.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Embed a batch of texts with the configured OpenAI embedding model.
 * text-embedding-3-small emits 1536-dimension vectors, matching vector(1536).
 * Responses are re-sorted by index so the caller's ordering is preserved.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input: texts,
    encoding_format: 'float',
  });
  const sorted = [...response.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}