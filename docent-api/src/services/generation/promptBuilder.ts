import type { RetrievalHit } from '../../types.js';

export const NO_EVIDENCE_MESSAGE =
  'I could not find information relevant to this question in the provided documents.';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

const SYSTEM_PROMPT = `You are a document-grounded question-answering assistant.
Rules:
1. Answer the question using ONLY the provided sources.
2. Base every factual claim on a source and cite it inline as [Source 1], [Source 2], etc.
3. If the sources do not contain enough information to answer the question, respond explicitly
   that you could not find the information in the provided documents. Do NOT guess, infer,
   or use outside knowledge.`;

export function buildSources(chunks: RetrievalHit[]): string[] {
  return chunks.map((c, i) => `[Source ${i + 1}, page ${c.pageNumber}]: ${c.content}`);
}

export function buildPrompt(question: string, sourcesBlock: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Sources:\n\n${sourcesBlock}\n\nQuestion:\n${question}`,
    },
  ];
}

/**
 * Scan the model's answer for inline citations of the form [Source 1] or
 * [Source 1, page 3] and return the distinct cited labels, ascending.
 */
export function extractCitedLabels(answer: string): number[] {
  const labels = new Set<number>();
  const re = /\[Source\s+(\d+)[^\]]*\]/gi;
  for (const match of answer.matchAll(re)) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1) labels.add(n);
  }
  return [...labels].sort((a, b) => a - b);
}