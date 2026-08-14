import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import type { Citation, RetrievalHit } from '../src/types.js';

/**
 * Phase 4 Definition-of-Done â€” flashcards + quizzes from notebook artifacts.
 *
 * Boots the real Express chat router in-process with a fake database and
 * canned retrieval chunks + generation responses so the DoD can be proven
 * under `npm test` without a live Supabase project or model API:
 *   1. POST /:id/artifacts/flashcards saves a well-formed flashcard_set whose
 *      cards carry source chunks + server-attached citations,
 *   2. malformed model output is retried once before succeeding,
 *   3. POST /:id/artifacts/quiz saves a well-formed quiz (4 options, index,
 *      explanation, citations),
 *   4. output malformed twice -> 422 (never persisted),
 *   5. input validation, scoping, and notebook isolation hold.
 */

// ---------------------------------------------------------------------------
// In-memory database used as the mock for supabaseClient.query()
// ---------------------------------------------------------------------------

interface MemNotebook {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
interface MemDocument {
  id: string;
  notebook_id: string;
  status: string;
}
interface MemArtifact {
  id: string;
  notebook_id: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: unknown | null;
  created_at: string;
}

const notebooks = new Map<string, MemNotebook>();
const documents = new Map<string, MemDocument>();
const chunkStore = new Map<string, RetrievalHit[]>();
const artifacts = new Map<string, MemArtifact>();
let seq = 0;
const uuid = () => `mock-${++seq}`;
const ts = () => new Date(1_700_000_000_000 + seq * 1000).toISOString();

async function fakeQuery<T>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  if (text.includes('select id from notebooks where id = $1')) {
    const nb = notebooks.get(String(params[0]));
    return { rows: (nb ? [{ id: nb.id }] : []) as unknown as T[] };
  }

  if (text.includes('where id = any')) {
    const [ids, notebookId] = params as [string[], string];
    const rows = ids
      .filter((id) => {
        const doc = documents.get(id);
        return doc && doc.notebook_id === notebookId && doc.status === 'ready';
      })
      .map((id) => ({ id }));
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('order by c.page_number asc')) {
    const [documentId, limit] = params as [string, number];
    const rows = (chunkStore.get(documentId) ?? []).slice(0, limit);
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('c.document_id = $2::uuid')) {
    const [, documentId, limit] = params as [string, string, number];
    const rows = (chunkStore.get(documentId) ?? []).slice(0, limit);
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('insert into artifacts')) {
    const [notebookId, type, title, content, citationsJson, payloadJson] = params as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const artifact: MemArtifact = {
      id: uuid(),
      notebook_id: notebookId,
      type,
      title,
      content: String(content),
      citations: JSON.parse(citationsJson) as Citation[],
      payload: JSON.parse(payloadJson) as unknown,
      created_at: ts(),
    };
    artifacts.set(artifact.id, artifact);
    return { rows: [artifact] as unknown as T[] };
  }

  if (text.includes('from artifacts where id = $1 and notebook_id = $2')) {
    const [artifactId, notebookId] = params as [string, string];
    const artifact = artifacts.get(artifactId);
    return {
      rows: (artifact && artifact.notebook_id === notebookId ? [artifact] : []) as unknown as T[],
    };
  }

  if (text.includes('from artifacts where notebook_id')) {
    const rows = [...artifacts.values()]
      .filter((a) => a.notebook_id === String(params[0]))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { rows: rows as unknown as T[] };
  }

  throw new Error(`fakeQuery: unhandled SQL -> ${text}`);
}

// ---------------------------------------------------------------------------
// Register module mocks, then import the real router.
// ---------------------------------------------------------------------------

const srcDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const mockTs = (rel: string, exports: Record<string, unknown>) => {
  const url = pathToFileURL(resolve(srcDir, rel)).href;
  mock.module(url, { exports } as unknown as Parameters<typeof mock.module>[1]);
};

mockTs('db/supabaseClient.ts', { query: fakeQuery });
mockTs('services/embeddings/embeddingClient.ts', {
  embedTexts: async (texts: string[]) => texts.map(() => [0.1]),
});

let responses: string[] = [];
let providerCalls = 0;
mockTs('services/generation/generationClient.ts', {
  createChatProvider: () => ({
    complete: async () => {
      providerCalls += 1;
      const content = responses.shift() ?? '';
      return { content, usage: { inputTokens: 5, outputTokens: 5 } };
    },
  }),
});

mockTs('services/reportExportService.ts', {
  renderReportPdf: async () => Buffer.from('FAKEPDFBYTES'),
  renderReportHtml: () => '<html/>',
  slugify: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
});

const { default: chatRouter } = await import('../src/routes/chat.js');
const { default: express } = await import('express');

const app = express();
app.use(express.json());
app.use('/notebooks', chatRouter);

const server = app.listen(0);
await once(server, 'listening');
const address = server.address();
const baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 3001}`;

// ---------------------------------------------------------------------------
// Test helpers + fixtures
// ---------------------------------------------------------------------------

function seedNotebook(id: string): void {
  notebooks.set(id, { id, name: 'Notebook', created_at: ts(), updated_at: ts() });
}

function seedReadyDocument(id: string, notebookId: string): void {
  documents.set(id, { id, notebook_id: notebookId, status: 'ready' });
}

function chunk(id: string, documentId: string, pageNumber: number): RetrievalHit {
  return {
    id,
    documentId,
    content: `Content of chunk ${id} on page ${pageNumber} about the topic.`,
    pageNumber,
    chunkIndex: pageNumber,
    tokenCount: 12,
    similarity: 0.8,
  };
}

function seedSourceDocs(notebookId: string): string[] {
  seedReadyDocument('doc-1', notebookId);
  seedReadyDocument('doc-2', notebookId);
  chunkStore.set('doc-1', [
    chunk('chunk-1a', 'doc-1', 1),
    chunk('chunk-1b', 'doc-1', 2),
    chunk('chunk-1c', 'doc-1', 3),
  ]);
  chunkStore.set('doc-2', [chunk('chunk-2a', 'doc-2', 1), chunk('chunk-2b', 'doc-2', 2)]);
  return ['doc-1', 'doc-2'];
}

interface ArtifactJson {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: unknown;
  createdAt: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

const postArtifact = (
  notebookId: string,
  kind: 'flashcards' | 'quiz' | 'mind-map' | 'report' | 'data-table',
  body: unknown,
) =>
  api<ArtifactJson>(`/notebooks/${notebookId}/artifacts/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function rawGet(path: string): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, headers: res.headers, text: await res.text() };
}

async function rawBytesGet(
  path: string,
): Promise<{ status: number; headers: Headers; arrayBuffer: ArrayBuffer }> {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, headers: res.headers, arrayBuffer: await res.arrayBuffer() };
}

seedNotebook('nb-a');
seedNotebook('nb-b');
const DOCS_A = seedSourceDocs('nb-a');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('DoD: flashcards generation saves a validated, grounded flashcard_set', async () => {
  responses = [
    JSON.stringify([
      {
        question: 'What is the first concept on page 1?',
        answer: 'It is covered in the page 1 chunk.',
        source_chunk_ids: ['chunk-1a', 'chunk-2a'],
      },
      {
        question: 'Which page covers the second concept?',
        answer: 'Page 2.',
        source_chunk_ids: ['chunk-1b', 'chunk-2b'],
      },
    ]),
    JSON.stringify([
      { index: 0, verdict: 'accurate' },
      { index: 1, verdict: 'accurate' },
    ]),
  ];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'flashcards', {
    document_ids: DOCS_A,
    topic: 'Data structures',
    difficulty: 'hard',
    count: 3,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'flashcard_set');
  assert.equal(res.body.title, 'Flashcards: Data structures');
  const payload = res.body.payload as Array<{
    question: string;
    answer: string;
    source_chunk_ids: string[];
    citations: Citation[];
  }>;
  assert.equal(providerCalls, 2, 'generation call + critique call');
  assert.equal(payload.length, 2);
  for (const item of payload) {
    assert.ok(typeof item.question === 'string' && item.question.length > 0);
    assert.ok(typeof item.answer === 'string' && item.answer.length > 0);
    assert.ok(Array.isArray(item.source_chunk_ids));
    assert.ok(item.source_chunk_ids.every((id) => id.startsWith('chunk-')), 'chunk ids from context');
    assert.ok(item.citations.length > 0, 'server attached citations');
    assert.ok(
      item.citations.every((c) => c.document_id === 'doc-1' || c.document_id === 'doc-2'),
      'citations point at scoped documents',
    );
  }
});

test('DoD: malformed model output is retried once before saving', async () => {
  responses = [
    'this is absolutely not json',
    JSON.stringify([{
      question: 'Retried question',
      answer: 'Retried answer',
      source_chunk_ids: ['chunk-1a'],
    }]),
    JSON.stringify([{ index: 0, verdict: 'accurate' }]),
  ];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'flashcards', { document_ids: DOCS_A, count: 1 });
  assert.equal(res.status, 201);
  assert.equal(providerCalls, 3, 'malformed generate + retry + critique');
  const payload = res.body.payload as Array<{ question: string }>;
  assert.equal(payload.length, 1);
  assert.equal(payload[0].question, 'Retried question');
});

test('DoD: self-critique revises items flagged as unsupported', async () => {
  responses = [
    JSON.stringify([
      { question: 'Good card', answer: 'Supported answer.', source_chunk_ids: ['chunk-1a'] },
      { question: 'Bad card', answer: 'A fabricated claim.', source_chunk_ids: ['chunk-1a'] },
    ]),
    JSON.stringify([
      { index: 0, verdict: 'accurate' },
      { index: 1, verdict: 'inaccurate', reason: 'answer not in source' },
    ]),
    JSON.stringify([
      { question: 'Bad card (corrected)', answer: 'A supported answer.', source_chunk_ids: ['chunk-1a'] },
    ]),
  ];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'flashcards', { document_ids: DOCS_A, count: 2 });
  assert.equal(res.status, 201);
  assert.equal(providerCalls, 3, 'generate + critique + revise');
  const payload = res.body.payload as Array<{ question: string; answer: string }>;
  assert.equal(payload.length, 2, 'accurate original kept + revised replacement');
  assert.ok(payload.some((p) => p.question === 'Good card'), 'accurate card untouched');
  assert.ok(
    payload.some((p) => p.question === 'Bad card (corrected)' && p.answer === 'A supported answer.'),
    'inaccurate card replaced by revised version',
  );
});

test('DoD: malformed critique keeps originals (best-effort, no 422)', async () => {
  responses = [
    JSON.stringify([
      { question: 'Only card', answer: 'Fine answer.', source_chunk_ids: ['chunk-1a'] },
    ]),
    'this critique output is not json at all',
  ];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'flashcards', { document_ids: DOCS_A, count: 1 });
  assert.equal(res.status, 201, 'critique failure must not fail generation');
  assert.equal(providerCalls, 2, 'generate + failed critique');
  const payload = res.body.payload as Array<{ question: string }>;
  assert.equal(payload.length, 1);
  assert.equal(payload[0].question, 'Only card');
});

test('DoD: quiz generation saves a validated quiz with 4 options + explanation', async () => {
  responses = [
    JSON.stringify([
      {
        question: 'Which page describes the core algorithm?',
        options: ['Page 1', 'Page 2', 'Page 3', 'None of these'],
        correct_index: 0,
        explanation: 'The core algorithm is described in the page 1 chunk.',
        source_chunk_ids: ['chunk-1a'],
      },
    ]),
    JSON.stringify([{ index: 0, verdict: 'accurate' }]),
  ];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'quiz', {
    document_ids: DOCS_A,
    topic: 'Algorithms',
    difficulty: 'easy',
    count: 1,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'quiz');
  const payload = res.body.payload as Array<{
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    source_chunk_ids: string[];
    citations: Citation[];
  }>;
  assert.equal(payload.length, 1);
  const q = payload[0];
  assert.equal(q.options.length, 4);
  assert.ok(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3);
  assert.equal(q.correct_index, 0);
  assert.ok(typeof q.explanation === 'string' && q.explanation.length > 0);
  assert.ok(q.citations.length > 0);
});

test('DoD: output malformed on both attempts -> 422 and nothing is saved', async () => {
  responses = ['{ not valid', 'still not an array'];
  const before = await api<ArtifactJson[]>(`/notebooks/nb-a/artifacts`);

  const res = await postArtifact('nb-a', 'flashcards', { document_ids: DOCS_A, count: 2 });
  assert.equal(res.status, 422);
  assert.ok(String((res.body as { error?: string }).error).toLowerCase().includes('malformed'));

  const after = await api<ArtifactJson[]>(`/notebooks/nb-a/artifacts`);
  assert.equal(after.body.length, before.body.length, 'no artifact persisted on failure');
});

test('artifacts are saved, listed, and isolated between notebooks', async () => {
  const listA = await api<ArtifactJson[]>(`/notebooks/nb-a/artifacts`);
  assert.equal(listA.status, 200);
  assert.ok(
    listA.body.some((a) => a.type === 'flashcard_set') &&
      listA.body.some((a) => a.type === 'quiz'),
    'both generated artifact types are listed',
  );

  const listB = await api<ArtifactJson[]>(`/notebooks/nb-b/artifacts`);
  assert.deepEqual(listB.body, [], 'other notebook sees no artifacts');
});

test('input validation: missing docs, bad count/difficulty, unknown notebook', async () => {
  const missing = await postArtifact('nb-a', 'flashcards', {});
  assert.equal(missing.status, 400);

  const badCount = await postArtifact('nb-a', 'quiz', { document_ids: DOCS_A, count: 25 });
  assert.equal(badCount.status, 400);

  const badDifficulty = await postArtifact('nb-a', 'flashcards', {
    document_ids: DOCS_A,
    difficulty: 'expert',
  });
  assert.equal(badDifficulty.status, 400);

  const ghost = await postArtifact('ghost', 'quiz', { document_ids: DOCS_A });
  assert.equal(ghost.status, 404);
});

test('no ready documents in scope -> 400', async () => {
  seedNotebook('nb-empty');
  const res = await postArtifact('nb-empty', 'flashcards', { document_ids: ['missing-doc'] });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Phase 5 â€” mind maps
// ---------------------------------------------------------------------------

interface MindMapJson {
  topic: string;
  children: Array<{
    label: string;
    source_chunk_id: string | null;
    citations: Citation[];
    children: MindMapJson['children'];
  }>;
}

function walkAll(nodes: MindMapJson['children']): MindMapJson['children'] {
  const all: MindMapJson['children'] = [];
  for (const n of nodes) {
    all.push(n);
    all.push(...walkAll(n.children));
  }
  return all;
}

function maxDepth(nodes: MindMapJson['children']): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(...nodes.map((n) => maxDepth(n.children)));
}

const HIERARCHICAL_TREE = {
  topic: 'Data structures',
  children: [
    {
      label: 'Arrays',
      source_chunk_id: 'chunk-1a',
      children: [
        { label: 'Contiguous memory', source_chunk_id: 'chunk-1b', children: [] },
        { label: 'O(1) indexing', source_chunk_id: 'chunk-1c', children: [] },
      ],
    },
    {
      label: 'Linked lists',
      source_chunk_id: 'chunk-2a',
      children: [{ label: 'Node pointers', source_chunk_id: 'chunk-2b', children: [] }],
    },
  ],
};

test('DoD: mind-map generation saves a genuinely hierarchical tree with grounded leaves', async () => {
  responses = [JSON.stringify(HIERARCHICAL_TREE)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'mind-map', { document_ids: DOCS_A, topic: 'Data structures' });
  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'mind_map');
  assert.equal(res.body.title, 'Mind map: Data structures');

  const payload = res.body.payload as MindMapJson;
  assert.equal(payload.topic, 'Data structures');
  assert.equal(payload.children.length, 2);
  const all = walkAll(payload.children);
  assert.ok(
    all.some((n) => n.children.length > 0),
    'sub-topics have their own children (real hierarchy, not flat)',
  );
  assert.ok(maxDepth(payload.children) >= 2, 'at least one node two levels below the root');
  const leaves = all.filter((n) => n.children.length === 0);
  assert.ok(leaves.length > 0, 'tree has leaves');
  for (const leaf of leaves) {
    assert.ok(leaf.citations.length > 0, `leaf "${leaf.label}" carries a source citation`);
    assert.ok(
      leaf.citations.every((c) => c.document_id === 'doc-1' || c.document_id === 'doc-2'),
      'citations point at scoped documents',
    );
    assert.ok(leaf.citations[0].chunk_content_snippet.length > 0, 'citation exposes source text');
  }
});

test('DoD: a flat (non-hierarchical) tree is rejected and retried until hierarchical', async () => {
  const flat = {
    topic: 'Flat topic',
    children: [
      { label: 'fact 1', source_chunk_id: 'chunk-1a', children: [] },
      { label: 'fact 2', source_chunk_id: 'chunk-1b', children: [] },
      { label: 'fact 3', source_chunk_id: 'chunk-1c', children: [] },
    ],
  };
  responses = [JSON.stringify(flat), JSON.stringify(HIERARCHICAL_TREE)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'mind-map', { document_ids: DOCS_A });
  assert.equal(res.status, 201, 'flat attempt is discarded and generation retried');
  assert.equal(providerCalls, 2, 'flat attempt + retry');
  const payload = res.body.payload as MindMapJson;
  assert.ok(maxDepth(payload.children) >= 2, 'retried tree is genuinely hierarchical');
});

test('mind map structure is truncated in code (children cap + depth cap)', async () => {
  const child = { label: 'x', source_chunk_id: 'chunk-1a', children: [] };
  const wide: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 10; i++) {
    wide.push({
      label: `sub-${i}`,
      source_chunk_id: 'chunk-1a',
      children: [child, { label: `fact-${i}`, source_chunk_id: 'chunk-1a', children: [] }],
    });
  }
  // One branch chains 4 levels below the root to test the depth cap.
  wide[0].children = [
    { label: 'l1', source_chunk_id: 'chunk-1a', children: [
      { label: 'l2', source_chunk_id: 'chunk-1a', children: [
        { label: 'l3', source_chunk_id: 'chunk-1a', children: [
          { label: 'l4-too-deep', source_chunk_id: 'chunk-1a', children: [] },
        ] },
      ] },
    ] },
  ];
  responses = [JSON.stringify({ topic: 'T', children: wide })];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'mind-map', { document_ids: DOCS_A });
  assert.equal(res.status, 201);
  const payload = res.body.payload as MindMapJson;
  assert.ok(payload.children.length <= 8, `children capped at 8, got ${payload.children.length}`);
  assert.ok(maxDepth(payload.children) <= 3, `depth capped at 3, got ${maxDepth(payload.children)}`);
});

test('mind map leaves without a valid source chunk are pruned', async () => {
  const tree = {
    topic: 'T',
    children: [
      {
        label: 'ok branch',
        source_chunk_id: 'chunk-1a',
        children: [
          { label: 'good leaf', source_chunk_id: 'chunk-1b', children: [] },
          { label: 'bad leaf', source_chunk_id: 'chunk-999', children: [] },
        ],
      },
      { label: 'uncited leaf', source_chunk_id: null, children: [] },
    ],
  };
  responses = [JSON.stringify(tree)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'mind-map', { document_ids: DOCS_A });
  assert.equal(res.status, 201);
  const payload = res.body.payload as MindMapJson;
  const all = walkAll(payload.children);
  assert.ok(all.every((n) => n.source_chunk_id === null || n.source_chunk_id.startsWith('chunk-')),
    'no out-of-context chunk ids survive');
  const leaves = all.filter((n) => n.children.length === 0);
  assert.ok(leaves.every((n) => n.citations.length > 0), 'every surviving leaf is grounded');
  assert.ok(!all.some((n) => n.label === 'uncited leaf'), 'uncited node pruned');
  assert.ok(!all.some((n) => n.label === 'bad leaf'), 'leaf citing unknown chunk pruned');
});

test('mind map malformed on both attempts -> 422', async () => {
  responses = ['{ definitely not json', 'still not a tree'];
  const res = await postArtifact('nb-a', 'mind-map', { document_ids: DOCS_A });
  assert.equal(res.status, 422);
  assert.ok(String((res.body as { error?: string }).error).toLowerCase().includes('mind map'));
});

test('mind map with no ready documents -> 400', async () => {
  seedNotebook('nb-empty-map');
  const res = await postArtifact('nb-empty-map', 'mind-map', { document_ids: ['missing-doc'] });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Phase 6 â€” reports / study guides (Markdown + PDF export)
// ---------------------------------------------------------------------------

const REPORT_MD = `# Transaction Management

## Core concepts

The page 1 chunk describes the core algorithm [Source 1], and page 2 extends it with recovery details [Source 2].

## Durability

Page 3 explains the logging that guarantees durability [Source 3]. This is the main takeaway.

## Summary

A study guide must faithfully synthesize the provided material [Source 4].`;

test('DoD: report generation saves structured Markdown with inline citation markers', async () => {
  responses = [REPORT_MD];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'report', {
    document_ids: DOCS_A,
    focus: 'Transaction management',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'report');
  assert.equal(res.body.title, 'Report: Transaction management', 'focus maps to the title');
  assert.ok(res.body.content.includes('# Transaction Management'), 'content is Markdown');
  assert.ok(res.body.content.includes('## Core concepts'), 'subheadings present');
  assert.ok(res.body.content.includes('[Source 1]'), 'inline citation markers present');
  assert.equal(providerCalls, 1, 'single generation call, no retry');

  const citations = res.body.citations ?? [];
  assert.ok(citations.length >= 2, 'citations resolved from inline markers');
  assert.ok(citations.every((c) => /^\[Source \d+\]$/.test(c.source_label)), 'labels match markers');
  assert.ok(
    citations.some((c) => c.document_id === 'doc-1') &&
      citations.some((c) => c.document_id === 'doc-2'),
    'citations point at scoped documents across the broad spread',
  );
});

test('report without inline citations is retried once before saving', async () => {
  responses = [`# No citations\n\n## Body\n\n${'x'.repeat(250)}`, REPORT_MD];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'report', { document_ids: DOCS_A, focus: 'Retry' });
  assert.equal(res.status, 201);
  assert.equal(providerCalls, 2, 'uncited attempt + retry');
  assert.ok((res.body.citations ?? []).length >= 1, 'retried report is cited');
});

test('report malformed on both attempts -> 422', async () => {
  responses = ['plain text with no headings at all', 'still nothing usable'];
  const res = await postArtifact('nb-a', 'report', { document_ids: DOCS_A });
  assert.equal(res.status, 422);
  assert.ok(String((res.body as { error?: string }).error).toLowerCase().includes('malformed'));
});

test('report with no ready documents -> 400', async () => {
  seedNotebook('nb-empty-report');
  const res = await postArtifact('nb-empty-report', 'report', { document_ids: ['missing-doc'] });
  assert.equal(res.status, 400);
});

test('DoD: exporting a report as Markdown streams the content as a download', async () => {
  responses = [REPORT_MD];
  const created = await postArtifact('nb-a', 'report', { document_ids: DOCS_A, focus: 'Export MD' });
  assert.equal(created.status, 201);

  const res = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=md`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  const cd = res.headers.get('content-disposition') ?? '';
  assert.ok(cd.startsWith('attachment; filename='), 'attachment disposition');
  assert.ok(cd.includes('.md'), 'md filename suffix');
  assert.equal(res.text, REPORT_MD, 'raw markdown body streamed');
});

test('DoD: exporting a report as PDF streams styled PDF bytes', async () => {
  responses = [REPORT_MD];
  const created = await postArtifact('nb-a', 'report', { document_ids: DOCS_A, focus: 'Export PDF' });
  assert.equal(created.status, 201);

  const res = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=pdf`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const cd = res.headers.get('content-disposition') ?? '';
  assert.ok(cd.startsWith('attachment; filename='));
  assert.ok(cd.includes('.pdf'), 'pdf filename suffix');
  assert.equal(res.text, 'FAKEPDFBYTES', 'pdf body streamed');
});

test('export validation: non-report artifact, unknown artifact, bad format, default pdf', async () => {
  responses = [REPORT_MD];
  const created = await postArtifact('nb-a', 'report', { document_ids: DOCS_A, focus: 'Validate' });
  assert.equal(created.status, 201);

  const nonReport = await rawGet(`/notebooks/nb-a/artifacts/mock-1/export?format=pdf`);
  assert.equal(nonReport.status, 400, 'flashcard artifact cannot be exported');

  const unknown = await rawGet(`/notebooks/nb-a/artifacts/does-not-exist/export?format=md`);
  assert.equal(unknown.status, 404);

  const badFormat = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=docx`);
  assert.equal(badFormat.status, 400);

  const defaultFormat = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export`);
  assert.equal(defaultFormat.status, 200);
  assert.equal(defaultFormat.headers.get('content-type'), 'application/pdf', 'defaults to pdf');
});

// ---------------------------------------------------------------------------
// Phase 8 â€” data tables (CSV / XLSX export)
// ---------------------------------------------------------------------------

interface DataTableModelResponse {
  columns: string[];
  rows: Array<Record<string, string>>;
  source_chunk_ids_by_row: string[][];
}
interface DataTablePayloadJson extends DataTableModelResponse {
  citations_by_row: Citation[][];
}

const TABLE_RESPONSE: DataTableModelResponse = {
  columns: ['Week', 'Topic', 'Reading'],
  rows: [
    { Week: '1', Topic: 'Introduction', Reading: 'Chapter 1' },
    { Week: '2', Topic: 'Data models', Reading: 'Chapter 2' },
    { Week: '3', Topic: 'SQL', Reading: 'Chapter 3, revised' },
  ],
  source_chunk_ids_by_row: [['chunk-1a'], ['chunk-1b'], ['chunk-1c']],
};

test('DoD: data-table generation saves a validated, per-row-grounded table', async () => {
  responses = [JSON.stringify(TABLE_RESPONSE)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'data-table', {
    document_ids: DOCS_A,
    columns_hint: 'extract weeks, topics, and readings',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'data_table');
  assert.equal(res.body.title, 'Data table: extract weeks, topics, and readings');
  assert.equal(providerCalls, 1, 'single generation call');
  const payload = res.body.payload as DataTablePayloadJson;
  assert.deepEqual(payload.columns, ['Week', 'Topic', 'Reading']);
  assert.equal(payload.rows.length, 3);
  for (const row of payload.rows) {
    assert.ok(Object.values(row).every((v) => typeof v === 'string'));
  }
  assert.deepEqual(payload.source_chunk_ids_by_row[0], ['chunk-1a'], 'row cites context chunk');
  assert.equal(payload.citations_by_row.length, 3, 'per-row citations attached');
  assert.equal(payload.citations_by_row[0][0].source_label, '[Row 1]');
  assert.equal(payload.citations_by_row[0][0].document_id, 'doc-1');
});

test('data table drops rows that are empty or cite unknown chunks (strict grounding)', async () => {
  const withBad: DataTableModelResponse = {
    columns: ['Name', 'Score'],
    rows: [
      { Name: 'Alice', Score: '92' },
      { Name: 'Bob', Score: '' },
      { Name: '', Score: '' },
      { Name: 'Mallory', Score: '7' },
    ],
    source_chunk_ids_by_row: [['chunk-1a'], ['chunk-1b'], ['chunk-999'], ['chunk-999']],
  };
  responses = [JSON.stringify(withBad)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(res.status, 201);
  const payload = res.body.payload as DataTablePayloadJson;
  assert.equal(payload.rows.length, 2, 'ungrounded + empty rows dropped');
  assert.ok(payload.rows.every((r) => r.Name !== 'Mallory' && r.Name !== ''));
  assert.ok(
    payload.source_chunk_ids_by_row.every((ids) => ids.every((id) => id.startsWith('chunk-'))),
    'every surviving row cites a context chunk',
  );
});

test('data table sanity cap: huge tables from small source sets are truncated', async () => {
  const wide: DataTableModelResponse = {
    columns: ['Col', 'Value'],
    rows: Array.from({ length: 50 }, (_, i) => ({ Col: `c${i}`, Value: `v${i}` })),
    source_chunk_ids_by_row: Array.from({ length: 50 }, () => ['chunk-1a']),
  };
  responses = [JSON.stringify(wide)];
  providerCalls = 0;

  const res = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(res.status, 201);
  const payload = res.body.payload as DataTablePayloadJson;
  // 5 context chunks * 3 = 15 (under the hard cap of 30).
  assert.equal(payload.rows.length, 15, 'rows truncated to the sanity cap');
});

test('data table with no ready documents -> 400', async () => {
  seedNotebook('nb-empty-table');
  const res = await postArtifact('nb-empty-table', 'data-table', { document_ids: ['missing-doc'] });
  assert.equal(res.status, 400);
});

test('data table malformed on both attempts -> 422; columns_hint validated', async () => {
  responses = ['{ definitely not a table', '{"columns": "not-an-array"}'];
  const res = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(res.status, 422);

  const badHint = await postArtifact('nb-a', 'data-table', {
    document_ids: DOCS_A,
    columns_hint: 42,
  });
  assert.equal(badHint.status, 400);
});

test('DoD: exporting a data table as CSV produces a correct CSV (quoting + BOM)', async () => {
  responses = [JSON.stringify(TABLE_RESPONSE)];
  const created = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(created.status, 201);

  const res = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=csv`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.ok(res.headers.get('content-disposition')?.includes('.csv'));
  const expected =
    'Week,Topic,Reading\r\n' +
    '1,Introduction,Chapter 1\r\n' +
    '2,Data models,Chapter 2\r\n' +
    '3,SQL,"Chapter 3, revised"\r\n';
  assert.equal(res.text, expected, 'CSV body is well-formed with quoting');

  const bytes = await rawBytesGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=csv`);
  const prefix = new Uint8Array(bytes.arrayBuffer.slice(0, 3));
  assert.deepEqual(Array.from(prefix), [0xef, 0xbb, 0xbf], 'UTF-8 BOM prefix so Excel decodes correctly');
});

test('DoD: exporting a data table as XLSX produces a real workbook (exceljs round-trip)', async () => {
  responses = [JSON.stringify(TABLE_RESPONSE)];
  const created = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(created.status, 201);

  const res = await rawBytesGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=xlsx`);
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.ok(res.headers.get('content-disposition')?.includes('.xlsx'));
  assert.ok(res.arrayBuffer.byteLength > 1000, 'real xlsx bytes');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.arrayBuffer);
  const ws = wb.worksheets[0];
  assert.equal(ws.name, 'Data');
  assert.deepEqual(
    Object.values(ws.getRow(1).values).filter((v) => v !== null && v !== undefined),
    ['Week', 'Topic', 'Reading'],
  );
  assert.equal(ws.getRow(2).getCell(1).value, '1');
  assert.equal(ws.getRow(2).getCell(2).value, 'Introduction');
  assert.equal(ws.getRow(4).getCell(3).value, 'Chapter 3, revised');
  assert.ok(ws.getRow(1).font?.bold, 'header row is bold');
});

test('data table export validation: bad format, unknown artifact, non-exportable type, default xlsx', async () => {
  responses = [JSON.stringify(TABLE_RESPONSE)];
  const created = await postArtifact('nb-a', 'data-table', { document_ids: DOCS_A });
  assert.equal(created.status, 201);

  const badFormat = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export?format=json`);
  assert.equal(badFormat.status, 400);

  const unknown = await rawGet(`/notebooks/nb-a/artifacts/does-not-exist/export?format=xlsx`);
  assert.equal(unknown.status, 404);

  const nonExportable = await rawGet(`/notebooks/nb-a/artifacts/mock-1/export?format=xlsx`);
  assert.equal(nonExportable.status, 400, 'flashcards cannot be exported');

  const defaultFormat = await rawGet(`/notebooks/nb-a/artifacts/${created.body.id}/export`);
  assert.equal(defaultFormat.status, 200);
  assert.equal(
    defaultFormat.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'data tables default to xlsx',
  );
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

after(() => server.close());