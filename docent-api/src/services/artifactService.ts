import { config } from '../config.js';
import { query } from '../db/supabaseClient.js';
import { toArtifactJson } from './chatService.js';
import { embedTexts } from './embeddings/embeddingClient.js';
import { createChatProvider, type ChatProvider } from './generation/generationClient.js';
import type { ChatMessage } from './generation/promptBuilder.js';
import { sampleChunksByPosition, searchChunksByTopic } from './retrieval/vectorSearch.js';
import type { ArtifactRow, ArtifactType, Citation, DataTablePayload, FlashcardItem, MindMapNode, MindMapTree, QuizItem, RetrievalHit } from '../types.js';

export class NoReadyDocumentsError extends Error {
  constructor() {
    super('No ready documents are available to generate study material from');
    this.name = 'NoReadyDocumentsError';
  }
}

export class MalformedOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedOutputError';
  }
}

export interface GenerateArtifactInput {
  notebookId: string;
  documentIds: string[];
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count: number;
  /** Optional user hint for what structured facts to extract (data tables). */
  columnsHint?: string;
}

type ItemKind = 'flashcard' | 'quiz';

const FLASHCARD_SCHEMA =
  '{ "question": string, "answer": string, "source_chunk_ids": string[] }';
const QUIZ_SCHEMA =
  '{ "question": string, "options": string[4], "correct_index": number (0-3), "explanation": string, "source_chunk_ids": string[] }';

const FLASHCARD_RULES = `You are an expert study-material generator. Create flashcards from ONLY the provided source chunks.
Rules:
1. Every card must be grounded in the provided sources: the question AND answer must be directly supported by the source chunks you cite. Never invent facts or use outside knowledge.
2. Cover the range of the provided material; do not repeat the same fact across cards.
3. Set source_chunk_ids to the exact chunk ids (from the "id=" field of each source) the card is based on. Only use ids that appear in the sources.
4. Respond with ONLY a valid JSON array — no markdown, no prose, no code fences.`;

const QUIZ_RULES = `You are an expert quiz generator. Create multiple-choice questions from ONLY the provided source chunks.
Rules:
1. Every question must be grounded in the provided sources. The correct answer and the explanation must be directly supported by the source chunks you cite. Never invent facts or use outside knowledge.
2. Provide exactly 4 options, one of which is correct. Set correct_index to the index (0-3) of the correct option.
3. Set source_chunk_ids to the exact chunk ids (from the "id=" field of each source) the question is based on. Only use ids that appear in the sources.
4. Respond with ONLY a valid JSON array — no markdown, no prose, no code fences.`;

const CRITIC_RULES = `You are a strict fact-checker for study material (NotebookLM-style verification). Your job is to judge whether each item is FULLY supported by ONLY its cited source excerpts.
Rules:
1. Mark "accurate" only if every claim in the item — the question, the answer, and any explanation — is directly stated in or directly inferable from the cited source excerpts.
2. Ambiguity, invented details, plausible-but-unsupported claims, or anything requiring outside knowledge = "inaccurate".
3. For quiz questions, verify that the option chosen by correct_index is the one actually supported and that the explanation agrees with the source.
4. Respond with ONLY a JSON array, one object per item, in order:
   [{"index": <item number>, "verdict": "accurate"|"inaccurate", "reason": "<short reason>"}]`;

const MIND_MAP_SCHEMA = `{
  "topic": string,
  "children": [
    { "label": string, "source_chunk_id": string, "children": [
      { "label": string, "source_chunk_id": string, "children": [
        { "label": string, "source_chunk_id": string, "children": [] }
      ] }
    ] }
  ]
}`;

const MIND_MAP_RULES = `You are an expert at building hierarchical study mind maps from source material.
Rules:
1. Build a genuine hierarchy from ONLY the provided source chunks: the root topic has 2-4 major sub-topic children, and each sub-topic branches into key facts/details. Go at least 2 levels deep below the root (sub-topic -> fact), and at most 3 levels deep. Prefer breadth over a single deep chain.
2. Use 5 to 8 children per node at most; do not flatten everything under the root — real sub-topics must have their own children.
3. Every node (sub-topics AND facts) must set source_chunk_id to the exact chunk id (from the "id=" field of each source) that supports its claim. Only use ids that appear in the sources.
4. Labels must be short phrases (2-8 words), not full sentences.
5. Respond with ONLY a valid JSON object matching the schema — no markdown, no prose, no code fences.`;

interface CritiqueVerdict {
  index: number;
  verdict: 'accurate' | 'inaccurate';
  reason?: string;
}

async function resolveScopedDocumentIds(notebookId: string, documentIds: string[]): Promise<string[]> {
  const { rows } = await query<{ id: string }>(
    `select id from documents where id = any($1::uuid[]) and status = 'ready' and notebook_id = $2`,
    [documentIds, notebookId],
  );
  return rows.map((r) => r.id);
}

interface ContextChunk {
  chunk: RetrievalHit;
  documentId: string;
  pageNumber: number;
  snippet: string;
}

/**
 * Broader retrieval than a single-question query: pull a wider spread across
 * the selected documents (per-document topic top-K, or positional coverage when
 * no topic is given) so a generated set has topic coverage, not answer precision.
 */
async function retrieveContext(input: GenerateArtifactInput): Promise<ContextChunk[]> {
  const scopedIds = await resolveScopedDocumentIds(input.notebookId, input.documentIds);
  if (scopedIds.length === 0) throw new NoReadyDocumentsError();

  const desired = Math.min(config.artifactContextChunks, Math.max(input.count * 2, 8));
  const perDocument = Math.max(1, Math.ceil(desired / scopedIds.length));

  let chunks: RetrievalHit[];
  const topic = input.topic?.trim();
  if (topic) {
    const [vector] = await embedTexts([topic]);
    chunks = await searchChunksByTopic(vector, scopedIds, perDocument);
  } else {
    chunks = await sampleChunksByPosition(scopedIds, perDocument);
  }

  return chunks.map((chunk) => ({
    chunk,
    documentId: chunk.documentId,
    pageNumber: chunk.pageNumber,
    snippet: chunk.content.replace(/\s+/g, ' ').slice(0, 400),
  }));
}

function formatSources(chunks: ContextChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}, page ${c.pageNumber}, id=${c.chunk.id}]: ${c.snippet}`,
    )
    .join('\n\n');
}

function buildMessages(
  kind: ItemKind,
  attempt: number,
  ctx: ContextChunk[],
  input: GenerateArtifactInput,
): ChatMessage[] {
  const rules = kind === 'flashcard' ? FLASHCARD_RULES : QUIZ_RULES;
  const schema = kind === 'flashcard' ? FLASHCARD_SCHEMA : QUIZ_SCHEMA;

  const retryNote =
    attempt > 0
      ? 'Your previous response was not valid JSON. Respond with ONLY a valid JSON array matching the schema — no markdown, no prose.\n'
      : '';

  return [
    { role: 'system', content: rules },
    {
      role: 'user',
      content: `${retryNote}Topic: ${topicLabel(input)}
Difficulty: ${input.difficulty ?? 'medium'}
Requested items: ${input.count}

Sources:
${formatSources(ctx)}

Respond with ONLY a valid JSON array where every element matches this schema:
${schema}`,
    },
  ];
}

function formatItemForCritic(kind: ItemKind, item: FlashcardItem | QuizItem): string {
  if (kind === 'flashcard') {
    const f = item as FlashcardItem;
    return `Q: ${f.question}\nA: ${f.answer}`;
  }
  const q = item as QuizItem;
  return [
    `Q: ${q.question}`,
    ...q.options.map((opt, i) => `  ${i}. ${opt}`),
    `Correct: index ${q.correct_index}`,
    `Explanation: ${q.explanation}`,
  ].join('\n');
}

function buildCritiqueMessages(
  kind: ItemKind,
  items: Array<FlashcardItem | QuizItem>,
  ctx: ContextChunk[],
): ChatMessage[] {
  const byId = new Map(ctx.map((c) => [c.chunk.id, c]));
  const sections = items
    .map((item, i) => {
      const cited = item.source_chunk_ids
        .map((id) => byId.get(id))
        .filter((c): c is ContextChunk => Boolean(c));
      return `Item ${i}:
${formatItemForCritic(kind, item)}

Cited sources:
${formatSources(cited) || '(no sources cited)'}`;
    })
    .join('\n\n');

  return [
    { role: 'system', content: CRITIC_RULES },
    {
      role: 'user',
      content: `Verify the following ${kind === 'flashcard' ? 'flashcards' : 'quiz questions'} against ONLY their cited source excerpts.

${sections}

Respond with ONLY a JSON array matching the schema — no markdown, no prose.`,
    },
  ];
}

function buildReviseMessages(
  kind: ItemKind,
  attempt: number,
  items: Array<FlashcardItem | QuizItem>,
  ctx: ContextChunk[],
): ChatMessage[] {
  const rules = kind === 'flashcard' ? FLASHCARD_RULES : QUIZ_RULES;
  const schema = kind === 'flashcard' ? FLASHCARD_SCHEMA : QUIZ_SCHEMA;
  const byId = new Map(ctx.map((c) => [c.chunk.id, c]));
  const citedIds = new Set<string>();
  for (const item of items) {
    for (const id of item.source_chunk_ids) if (byId.has(id)) citedIds.add(id);
  }
  const cited = [...citedIds].map((id) => byId.get(id) as ContextChunk);

  const retryNote =
    attempt > 0
      ? 'Your previous response was not valid JSON. Respond with ONLY a valid JSON array matching the schema — no markdown, no prose.\n'
      : '';

  return [
    { role: 'system', content: rules },
    {
      role: 'user',
      content: `${retryNote}The following items were flagged as NOT fully supported by the sources. Rewrite each one so the question, answer, and explanation are grounded ONLY in the provided sources. Keep the same number of items.

Flagged items (JSON):
${JSON.stringify(items, null, 2)}

Sources:
${formatSources(cited)}

Respond with ONLY a valid JSON array where every element matches this schema:
${schema}`,
    },
  ];
}

function topicLabel(input: GenerateArtifactInput): string {
  const t = input.topic?.trim();
  return t && t.length > 0 ? t : 'general coverage of the provided sources';
}

/** Extract a JSON array from a model answer, tolerating markdown fences. */
function extractJsonArray(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new MalformedOutputError('Model output contained no JSON array');
  }
  const parsed: unknown = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new MalformedOutputError('Model output was not a JSON array');
  }
  return parsed;
}

/** Extract a JSON object from a model answer, tolerating markdown fences. */
function extractJsonObject(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new MalformedOutputError('Model output contained no JSON object');
  }
  return JSON.parse(t.slice(start, end + 1));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function validFlashcard(x: unknown): x is FlashcardItem {
  const o = x as FlashcardItem;
  return (
    typeof o?.question === 'string' &&
    o.question.trim().length > 0 &&
    typeof o?.answer === 'string' &&
    o.answer.trim().length > 0 &&
    isStringArray(o?.source_chunk_ids)
  );
}

function validQuiz(x: unknown): x is QuizItem {
  const o = x as QuizItem;
  return (
    typeof o?.question === 'string' &&
    o.question.trim().length > 0 &&
    isStringArray(o?.options) &&
    o.options.length === 4 &&
    o.options.every((s) => s.trim().length > 0) &&
    Number.isInteger(o?.correct_index) &&
    o.correct_index >= 0 &&
    o.correct_index <= 3 &&
    typeof o?.explanation === 'string' &&
    o.explanation.trim().length > 0 &&
    isStringArray(o?.source_chunk_ids)
  );
}

function validVerdict(x: unknown): x is CritiqueVerdict {
  const o = x as CritiqueVerdict;
  return (
    typeof o?.index === 'number' &&
    Number.isInteger(o.index) &&
    (o.verdict === 'accurate' || o.verdict === 'inaccurate')
  );
}

/** Attach server-side citations, filtering chunk ids to ones actually in context. */
function attachCitations<T extends { source_chunk_ids: string[] }>(
  items: T[],
  ctx: ContextChunk[],
): Array<T & { citations: Citation[] }> {
  const byId = new Map(ctx.map((c) => [c.chunk.id, c]));
  return items.map((item) => {
    const seen = new Set<string>();
    const citations: Citation[] = [];
    for (const id of item.source_chunk_ids) {
      const c = byId.get(id);
      if (!c) continue;
      const key = `${c.documentId}:${c.pageNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        source_label: `[Source ${citations.length + 1}]`,
        document_id: c.documentId,
        page_number: c.pageNumber,
        chunk_content_snippet: c.snippet,
      });
    }
    return { ...item, citations };
  });
}

/**
 * NotebookLM-style self-critique: ask a critic model to verify every item
 * against its cited source chunks, then revise the items it flags as
 * unsupported. Best-effort — if the critique or revision output is malformed,
 * the original items are kept rather than failing the whole generation.
 */
async function critiqueAndRevise(
  kind: ItemKind,
  items: Array<FlashcardItem | QuizItem>,
  ctx: ContextChunk[],
  provider: ChatProvider,
): Promise<Array<FlashcardItem | QuizItem>> {
  const knownIds = new Set(ctx.map((c) => c.chunk.id));

  let verdicts: CritiqueVerdict[] | null = null;
  try {
    const result = await provider.complete(buildCritiqueMessages(kind, items, ctx));
    const parsed = extractJsonArray(result.content) as unknown[];
    verdicts = parsed.filter(validVerdict);
  } catch {
    verdicts = null;
  }
  if (!verdicts || verdicts.length === 0) return items;

  const inaccurate = new Set(
    verdicts.filter((v) => v.verdict === 'inaccurate').map((v) => v.index),
  );
  if (inaccurate.size === 0) return items;

  const toRevise = items.filter((_, i) => inaccurate.has(i));

  let revised: Array<FlashcardItem | QuizItem> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete(buildReviseMessages(kind, attempt, toRevise, ctx));
      const parsed = extractJsonArray(result.content) as unknown[];
      const valid = (kind === 'flashcard'
        ? parsed.filter(validFlashcard)
        : parsed.filter(validQuiz)) as Array<FlashcardItem | QuizItem>;
      if (valid.length === 0) throw new MalformedOutputError('Model returned no valid items');
      revised = valid;
      break;
    } catch (err) {
      if (!(err instanceof MalformedOutputError)) throw err;
    }
  }
  if (!revised) return items;

  const merged = items.filter((_, i) => !inaccurate.has(i));
  merged.push(
    ...revised.map((r) => ({
      ...r,
      source_chunk_ids: r.source_chunk_ids.filter((id) => knownIds.has(id)),
    })),
  );
  return merged;
}

async function generateItems(
  kind: ItemKind,
  input: GenerateArtifactInput,
): Promise<Array<FlashcardItem | QuizItem>> {
  const ctx = await retrieveContext(input);
  const knownIds = new Set(ctx.map((c) => c.chunk.id));
  const provider = createChatProvider();

  let lastError: Error | null = null;
  let items: Array<FlashcardItem | QuizItem> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete(buildMessages(kind, attempt, ctx, input));
      const parsed = extractJsonArray(result.content) as unknown[];
      const valid = kind === 'flashcard'
        ? parsed.filter(validFlashcard)
        : parsed.filter(validQuiz);
      if (valid.length === 0) {
        throw new MalformedOutputError('Model output contained no valid items');
      }
      items = valid.map((item) => ({
        ...item,
        source_chunk_ids: item.source_chunk_ids.filter((id: string) => knownIds.has(id)),
      }));
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown generation error');
      if (!(err instanceof MalformedOutputError)) throw err;
    }
  }
  if (!items) {
    throw new MalformedOutputError(
      `Model returned malformed output twice: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  const verified = await critiqueAndRevise(kind, items, ctx, provider);
  return attachCitations(verified, ctx);
}

async function insertArtifact(
  notebookId: string,
  type: ArtifactType,
  title: string,
  items: unknown,
): Promise<ReturnType<typeof toArtifactJson>> {
  const { rows } = await query<ArtifactRow>(
    `insert into artifacts (notebook_id, type, title, content, citations, payload)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     returning id, notebook_id, type, title, content, citations, payload, created_at`,
    [notebookId, type, title, '', JSON.stringify([]), JSON.stringify(items)],
  );
  return toArtifactJson(rows[0]);
}

export async function generateFlashcards(input: GenerateArtifactInput) {
  const items = await generateItems('flashcard', input);
  const title = input.topic?.trim() ? `Flashcards: ${input.topic.trim()}` : 'Flashcard set';
  return insertArtifact(input.notebookId, 'flashcard_set', title, items);
}

export async function generateQuiz(input: GenerateArtifactInput) {
  const items = await generateItems('quiz', input);
  const title = input.topic?.trim() ? `Quiz: ${input.topic.trim()}` : 'Quiz';
  return insertArtifact(input.notebookId, 'quiz', title, items);
}

// ---------------------------------------------------------------------------
// Mind maps — a hierarchical topic tree with per-node source citations.
// The structure is validated and truncated in code after parsing: depth is
// capped, per-node children are capped, and every surviving leaf is required
// to carry a source_chunk_id that is actually present in the retrieved
// context — the grounding guarantee behind the "click a leaf -> supporting
// source text" DoD.
// ---------------------------------------------------------------------------

function buildMindMapMessages(
  attempt: number,
  ctx: ContextChunk[],
  input: GenerateArtifactInput,
): ChatMessage[] {
  const retryNote =
    attempt > 0
      ? 'Your previous response was not a valid JSON object or did not meet the structure rules. Respond with ONLY a valid JSON object matching the schema — no markdown, no prose.\n'
      : '';

  return [
    { role: 'system', content: MIND_MAP_RULES },
    {
      role: 'user',
      content: `${retryNote}Topic: ${topicLabel(input)}

Sources:
${formatSources(ctx)}

Respond with ONLY a valid JSON object matching this schema:
${MIND_MAP_SCHEMA}`,
    },
  ];
}

function hasNodeAtDepth(nodes: MindMapNode[], depth: number): boolean {
  return nodes.some((n) => (depth <= 1 ? true : hasNodeAtDepth(n.children, depth - 1)));
}

/**
 * Parse + validate the model's tree, then enforce the structural caps:
 *   - children per node   <= config.mindMapMaxChildren
 *   - depth               <= config.mindMapMaxDepth (levels below the root)
 *   - leaves must cite a chunk id present in context, else the leaf is pruned
 *   - the tree must be genuinely hierarchical (a sub-topic at depth >= 2),
 *     otherwise the response is treated as malformed so generation retries.
 */
function validateAndTruncateMindMap(tree: unknown, ctx: ContextChunk[]): MindMapTree {
  const root = tree as { topic?: unknown; children?: unknown };
  if (typeof root?.topic !== 'string' || root.topic.trim().length === 0) {
    throw new MalformedOutputError('Mind map root topic is missing or empty');
  }

  const maxDepth = config.mindMapMaxDepth;
  const maxChildren = config.mindMapMaxChildren;
  const knownIds = new Set(ctx.map((c) => c.chunk.id));

  function walk(node: unknown, depth: number): MindMapNode | null {
    const o = node as { label?: unknown; source_chunk_id?: unknown; children?: unknown };
    if (typeof o?.label !== 'string' || o.label.trim().length === 0) return null;
    const chunkId =
      typeof o.source_chunk_id === 'string' && knownIds.has(o.source_chunk_id)
        ? o.source_chunk_id
        : undefined;

    let children: MindMapNode[] = [];
    if (Array.isArray(o.children) && depth < maxDepth) {
      children = o.children
        .map((c) => walk(c, depth + 1))
        .filter((n): n is MindMapNode => n !== null)
        .slice(0, maxChildren);
    }

    // A leaf (no surviving children) must be grounded in a real chunk, and an
    // internal node that lost all of its children falls back to being a leaf —
    // still requiring a citation. Nodes with neither are pruned.
    if (children.length === 0 && !chunkId) return null;

    return { label: o.label.trim(), source_chunk_id: chunkId, citations: [], children };
  }

  const children = (Array.isArray(root.children) ? root.children : [])
    .map((c) => walk(c, 1))
    .filter((n): n is MindMapNode => n !== null)
    .slice(0, maxChildren);

  // Genuinely hierarchical means there is at least one fact two levels below
  // the root. A flat list dressed as a tree fails and triggers a retry.
  if (children.length === 0 || !hasNodeAtDepth(children, 2)) {
    throw new MalformedOutputError('Mind map was flat or empty — not a real hierarchy');
  }

  return { topic: root.topic.trim(), children };
}

function attachMindMapCitations(tree: MindMapTree, ctx: ContextChunk[]): MindMapTree {
  const byId = new Map(ctx.map((c) => [c.chunk.id, c]));

  function walk(node: MindMapNode): MindMapNode {
    const citations: Citation[] = [];
    if (node.source_chunk_id) {
      const c = byId.get(node.source_chunk_id);
      if (c) {
        citations.push({
          source_label: '[Source 1]',
          document_id: c.documentId,
          page_number: c.pageNumber,
          chunk_content_snippet: c.snippet,
        });
      }
    }
    return { ...node, citations, children: node.children.map(walk) };
  }

  return { ...tree, children: tree.children.map(walk) };
}

async function generateMindMapTree(input: GenerateArtifactInput): Promise<MindMapTree> {
  const ctx = await retrieveContext(input);
  const provider = createChatProvider();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete(buildMindMapMessages(attempt, ctx, input));
      const parsed = extractJsonObject(result.content);
      const tree = validateAndTruncateMindMap(parsed, ctx);
      return attachMindMapCitations(tree, ctx);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown mind-map generation error');
      if (!(err instanceof MalformedOutputError)) throw err;
    }
  }
  throw new MalformedOutputError(
    `Model returned a malformed or non-hierarchical mind map twice: ${lastError?.message ?? 'unknown error'}`,
  );
}

export async function generateMindMap(input: GenerateArtifactInput) {
  const tree = await generateMindMapTree(input);
  const title = input.topic?.trim() ? `Mind map: ${input.topic.trim()}` : 'Mind map';
  return insertArtifact(input.notebookId, 'mind_map', title, tree);
}

// ---------------------------------------------------------------------------
// Reports / study guides — a long-form Markdown document that synthesizes the
// sources. Every major claim is followed by an inline [Source N] marker; the
// markers are resolved server-side into a citations array (same convention as
// the grounded chat), so the UI and PDF can render them as clickable/styled
// citation markers.
// ---------------------------------------------------------------------------

const REPORT_RULES = `You are an expert study-guide writer. Write a long-form Markdown study guide that synthesizes ONLY the provided source chunks.
Rules:
1. Structure the guide with Markdown headings (#, ##, ###), subheadings, and readable body paragraphs. Use bullet lists where they genuinely help.
2. Every major claim MUST be followed by an inline citation marker referencing the source it came from, using the exact form [Source N] where N is the number of the source listed below. Cite multiple sources where a claim draws on more than one.
3. Never invent facts, examples, or numbers not present in the sources. The guide must be a faithful synthesis, not outside knowledge.
4. Cover the range of the provided material — do not fixate on a single chunk.
5. Respond with ONLY the Markdown document — no preamble, no prose outside the document, no code fences.`;

const REPORT_CITATION_RE = /\[Source\s+(\d+)\]/g;

function extractReportContent(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  return t;
}

function buildReportMessages(
  attempt: number,
  ctx: ContextChunk[],
  input: GenerateArtifactInput,
): ChatMessage[] {
  const retryNote =
    attempt > 0
      ? 'Your previous response was not a usable Markdown study guide (it had no headings, no body, or no inline [Source N] citations). Respond with ONLY the Markdown document.\n'
      : '';

  return [
    { role: 'system', content: REPORT_RULES },
    {
      role: 'user',
      content: `${retryNote}Focus: ${topicLabel(input)}

Sources:
${formatSources(ctx)}

Write the Markdown study guide now.`,
    },
  ];
}

/**
 * Resolve every [Source N] marker used in the report body into a citation,
 * using the same numbered source list the model was given (Source 1..N map to
 * ctx[0..N-1]). Only markers that resolve to a real chunk are kept.
 */
function buildReportCitations(content: string, ctx: ContextChunk[]): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<number>();
  for (const m of content.matchAll(REPORT_CITATION_RE)) {
    const n = Number(m[1]);
    if (seen.has(n)) continue;
    seen.add(n);
    const c = ctx[n - 1];
    if (!c) continue;
    citations.push({
      source_label: `[Source ${n}]`,
      document_id: c.documentId,
      page_number: c.pageNumber,
      chunk_content_snippet: c.snippet,
    });
  }
  return citations;
}

/**
 * A usable report must be non-trivial Markdown: at least one heading, a real
 * body, and at least one inline citation marker. Anything less is treated as
 * malformed so generation retries once.
 */
function validReport(content: string, ctx: ContextChunk[]): boolean {
  const t = content.trim();
  const hasHeading = /^#{1,6}\s+\S/m.test(t);
  const hasBody = t.replace(/^#{1,6}.*$/gm, '').trim().length >= 200;
  const citations = buildReportCitations(content, ctx);
  return hasHeading && hasBody && citations.length > 0;
}

export async function generateReport(input: GenerateArtifactInput) {
  const ctx = await retrieveContext(input);
  const provider = createChatProvider();

  let lastError: Error | null = null;
  let content = '';
  let citations: Citation[] = [];
  let saved = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete(buildReportMessages(attempt, ctx, input));
      const candidate = extractReportContent(result.content);
      const candidateCitations = buildReportCitations(candidate, ctx);
      if (!validReport(candidate, ctx)) {
        throw new MalformedOutputError('Model output was not a usable Markdown report');
      }
      content = candidate;
      citations = candidateCitations;
      saved = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown report generation error');
      if (!(err instanceof MalformedOutputError)) throw err;
    }
  }
  if (!saved) {
    throw new MalformedOutputError(
      `Model returned a malformed report twice: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  const title = input.topic?.trim() ? `Report: ${input.topic.trim()}` : 'Report';
  const { rows } = await query<ArtifactRow>(
    `insert into artifacts (notebook_id, type, title, content, citations, payload)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     returning id, notebook_id, type, title, content, citations, payload, created_at`,
    [input.notebookId, 'report', title, content, JSON.stringify(citations), JSON.stringify(null)],
  );
  return toArtifactJson(rows[0]);
}

// ---------------------------------------------------------------------------
// Data tables — structured extraction (CSV/XLSX export). The artifact type most
// prone to hallucinated structure: the model only ever suggests structure, and
// every row is gated on a citation to a chunk that is genuinely in context.
// A table suspiciously large relative to the number of source chunks is
// truncated in code (the "flag suspiciously large tables" sanity check).
// ---------------------------------------------------------------------------

const DATA_TABLE_SCHEMA = `{
  "columns": string[],
  "rows": [ { "<column name>": "<cell value>", ... }, ... ],
  "source_chunk_ids_by_row": [ string[], ... ]
}`;

const DATA_TABLE_RULES = `You are a precise structured-data extractor. Build a data table from ONLY the provided source chunks.
Rules:
1. Extract a fact into a row ONLY if the source genuinely and explicitly states that structured fact. If the material has no table-like structure, return an empty rows array — never invent rows to fill the table.
2. Never fabricate dates, values, names, or numbers. Hallucinated structure is the single worst failure mode here — prefer too few rows over invented ones.
3. Each row must have a value for at least one column; use an empty string "" where a source leaves a cell genuinely blank.
4. Keep cell values short and verbatim (or near-verbatim) from the source; do not paraphrase into invented precision.
5. Set source_chunk_ids_by_row[i] to the exact chunk ids (from the "id=" field of each source) that state the facts in rows[i]. Every row must cite at least one id that appears in the sources.
6. Respond with ONLY a valid JSON object matching the schema — no markdown, no prose, no code fences.`;

interface CleanedDataTable {
  columns: string[];
  rows: Array<Record<string, string>>;
  source_chunk_ids_by_row: string[][];
}

function buildDataTableMessages(
  attempt: number,
  ctx: ContextChunk[],
  input: GenerateArtifactInput,
): ChatMessage[] {
  const retryNote =
    attempt > 0
      ? 'Your previous response was not a usable structured table (bad JSON, no columns, or rows without valid source chunk ids). Respond with ONLY a valid JSON object matching the schema.\n'
      : '';
  const hint =
    input.columnsHint?.trim()
      ? `\nExtraction focus (user request, optional guidance): ${input.columnsHint.trim()}`
      : '';

  return [
    { role: 'system', content: DATA_TABLE_RULES },
    {
      role: 'user',
      content: `${retryNote}${input.topic?.trim() ? `Topic: ${input.topic.trim()}\n` : ''}Extract a data table from these sources${hint}:

Sources:
${formatSources(ctx)}

Respond with ONLY a valid JSON object matching this schema:
${DATA_TABLE_SCHEMA}`,
    },
  ];
}

/**
 * Strictly validate + clean the model's table suggestion:
 *  - columns must be a non-empty array of unique strings (bounded),
 *  - a row survives only if it has a real cell value AND cites at least one
 *    chunk id that is genuinely in context,
 *  - rows are truncated to the sanity cap (≈2 rows per source chunk, hard cap
 *    config.dataTableMaxRows) — the "flag suspiciously large tables" check.
 * Returns null when the shape is fundamentally unusable (=> retry as malformed).
 */
function cleanDataTable(payload: unknown, ctx: ContextChunk[]): CleanedDataTable | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.columns) || !Array.isArray(p.rows) || !Array.isArray(p.source_chunk_ids_by_row)) {
    return null;
  }
  const ctxById = new Map(ctx.map((c) => [c.chunk.id, c]));

  const columns = p.columns
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim());
  if (columns.length === 0 || columns.length > config.dataTableMaxColumns) return null;
  if (new Set(columns).size !== columns.length) return null;

  const rawRows = p.rows as unknown[];
  const rawIds = p.source_chunk_ids_by_row as unknown[];

  const rows: Array<Record<string, string>> = [];
  const sourceChunkIdsByRow: string[][] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;

    const cell: Record<string, string> = {};
    let anyValue = false;
    for (const col of columns) {
      const raw = record[col];
      const s = raw === null || raw === undefined ? '' : String(raw).trim();
      cell[col] = s;
      if (s.length > 0) anyValue = true;
    }
    if (!anyValue) continue;

    const ids = Array.isArray(rawIds[i])
      ? [...new Set((rawIds[i] as unknown[]).filter((x): x is string => typeof x === 'string' && ctxById.has(x)))]
      : [];
    if (ids.length === 0) continue;

    rows.push(cell);
    sourceChunkIdsByRow.push(ids);
  }

  const cap = Math.min(
    config.dataTableMaxRows,
    Math.max(ctx.length * config.dataTableRowRatio, 8),
  );
  if (rows.length > cap) {
    rows.length = cap;
    sourceChunkIdsByRow.length = cap;
  }

  return { columns, rows, source_chunk_ids_by_row: sourceChunkIdsByRow };
}

function attachDataTableCitations(value: CleanedDataTable, ctx: ContextChunk[]): DataTablePayload {
  const ctxById = new Map(ctx.map((c) => [c.chunk.id, c]));
  const citations_by_row: Citation[][] = value.source_chunk_ids_by_row.map((ids, i) =>
    ids.map((id) => {
      const c = ctxById.get(id)!;
      return {
        source_label: `[Row ${i + 1}]`,
        document_id: c.documentId,
        page_number: c.pageNumber,
        chunk_content_snippet: c.snippet,
      };
    }),
  );
  return { ...value, citations_by_row };
}

export async function generateDataTable(input: GenerateArtifactInput) {
  const ctx = await retrieveContext(input);
  const provider = createChatProvider();

  let lastError: Error | null = null;
  let value: CleanedDataTable | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.complete(buildDataTableMessages(attempt, ctx, input));
      const cleaned = cleanDataTable(extractJsonObject(result.content), ctx);
      if (!cleaned) {
        throw new MalformedOutputError('Model output was not a usable structured data table');
      }
      value = cleaned;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown data-table generation error');
      if (!(err instanceof MalformedOutputError)) throw err;
    }
  }
  if (!value) {
    throw new MalformedOutputError(
      `Model returned a malformed data table twice: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  const payload = attachDataTableCitations(value, ctx);
  const title = input.topic?.trim()
    ? `Data table: ${input.topic.trim()}`
    : input.columnsHint?.trim()
      ? `Data table: ${input.columnsHint.trim()}`
      : 'Data table';
  return insertArtifact(input.notebookId, 'data_table', title, payload);
}