import OpenAI from 'openai';
import { config } from '../../config.js';

const EMBED_BATCH_SIZE = 100;

async function embedWithGemini(texts: string[]): Promise<number[][]> {
  const url = `${config.embeddingBaseUrl}/models/${config.embeddingModel}:batchEmbedContents`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.embeddingApiKey,
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${config.embeddingModel}`,
        content: { parts: [{ text }] },
        outputDimensionality: config.embeddingDimensions,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embedding request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
  const embeddings = data.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(`Embedding API returned ${embeddings.length} results for ${texts.length} inputs`);
  }
  return embeddings.map((e) => e.values ?? []);
}

const openAiClient = new OpenAI({
  apiKey: config.embeddingApiKey,
  baseURL: config.embeddingProvider === 'openai' ? config.embeddingBaseUrl : undefined,
});

async function embedWithOpenAi(texts: string[]): Promise<number[][]> {
  const response = await openAiClient.embeddings.create({
    model: config.embeddingModel,
    input: texts,
    encoding_format: 'float',
  });
  const sorted = [...response.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Embed a batch of texts with the configured provider, preserving caller order.
 * Default is Google Gemini's native batchEmbedContents (text-embedding-004,
 * 768 dimensions); OpenAI is supported via EMBEDDING_PROVIDER=openai.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors =
      config.embeddingProvider === 'openai' ? await embedWithOpenAi(batch) : await embedWithGemini(batch);
    all.push(...vectors);
  }
  return all;
}