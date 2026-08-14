import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Citation, RetrievalHit } from '../src/types.js';

/**
 * Phase 2 Definition-of-Done — notebook chat + history + artifacts.
 *
 * Boots the real Express chat router in-process with a fake database and
 * canned retrieval/generation results so the DoD can be proven under
 * `npm test` without a live Supabase project or model API:
 *   1. answerable questions (2) return grounded answers with citations,
 *   2. out-of-scope questions (2) decline honestly (not_found, no fabrication),
 *   3. a cross-page synthesis question cites more than one page,
 *   4. chat history persists across a refresh (GET /:id/messages reload),
 *   5. saving an assistant answer as a note creates a real artifact row
 *      retrievable via /:id/artifacts, scoped to the owning notebook.
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
interface MemMessage {
  id: string;
  notebook_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  confidence: string | null;
  created_at: string;
}
interface MemArtifact {
  id: string;
  notebook_id: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

const notebooks = new Map<string, MemNotebook>();
const documents = new Map<string, MemDocument>();
const messages = new Map<string, MemMessage>();
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

  if (text.includes('insert into chat_messages') && text.includes('returning id')) {
    const [notebookId, content, citationsJson, confidence] = params as [
      string,
      string,
      string,
      string,
    ];
    const id = uuid();
    messages.set(id, {
      id,
      notebook_id: notebookId,
      role: 'assistant',
      content,
      citations: JSON.parse(citationsJson) as Citation[],
      confidence,
      created_at: ts(),
    });
    return { rows: [{ id } as unknown as T] };
  }

  if (text.includes('insert into chat_messages')) {
    const [notebookId, content] = params as [string, string];
    const id = uuid();
    messages.set(id, {
      id,
      notebook_id: notebookId,
      role: 'user',
      content,
      citations: null,
      confidence: null,
      created_at: ts(),
    });
    return { rows: [] as unknown as T[] };
  }

  if (text.includes('from chat_messages where notebook_id')) {
    const rows = [...messages.values()]
      .filter((m) => m.notebook_id === String(params[0]))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('from chat_messages where id = $1')) {
    const [messageId, notebookId] = params as [string, string];
    const msg = [...messages.values()].find(
      (m) => m.id === messageId && m.notebook_id === notebookId,
    );
    return { rows: (msg ? [msg] : []) as unknown as T[] };
  }

  if (text.includes('insert into artifacts')) {
    const [notebookId, title, content, citationsJson] = params as [string, string, string, string];
    const artifact: MemArtifact = {
      id: uuid(),
      notebook_id: notebookId,
      type: 'saved_note',
      title,
      content,
      citations: JSON.parse(citationsJson) as Citation[],
      created_at: ts(),
    };
    artifacts.set(artifact.id, artifact);
    return { rows: [artifact] as unknown as T[] };
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
// Register module mocks, then import the real routers.
// ---------------------------------------------------------------------------

const srcDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const mockTs = (rel: string, exports: Record<string, unknown>) => {
  // tsx resolves .js import specifiers to the .ts source; register the .ts URL
  // (node canonicalizes it to the identity the importers see).
  const url = pathToFileURL(resolve(srcDir, rel)).href;
  // `exports` is the current runtime option (namedExports is deprecated at runtime
  // but still the only one in @types/node); cast past the stale type.
  mock.module(url, { exports } as unknown as Parameters<typeof mock.module>[1]);
};

mockTs('db/supabaseClient.ts', { query: fakeQuery });
mockTs('services/embeddings/embeddingClient.ts', {
  embedTexts: async (texts: string[]) => texts.map(() => [0.1]),
});

// Per-test retrieval + generation fixtures.
let nextHits: RetrievalHit[] = [];
let nextAnswer = '';
mockTs('services/retrieval/vectorSearch.ts', {
  searchChunks: async () => nextHits,
  searchChunksByTopic: async () => [],
  sampleChunksByPosition: async () => [],
});
mockTs('services/generation/generationClient.ts', {
  createChatProvider: () => ({
    complete: async () => ({
      content: nextAnswer,
      usage: { inputTokens: 10, outputTokens: 20 },
    }),
  }),
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
// Test helpers
// ---------------------------------------------------------------------------

function seedNotebook(id: string, name = 'Notebook'): void {
  notebooks.set(id, { id, name, created_at: ts(), updated_at: ts() });
}

function seedDocument(id: string, notebookId: string, status = 'ready'): void {
  documents.set(id, { id, notebook_id: notebookId, status });
}

function hit(
  documentId: string,
  pageNumber: number,
  similarity: number,
  content = 'Grounded source content for this chunk.',
): RetrievalHit {
  return {
    id: `chunk-${documentId}-p${pageNumber}`,
    documentId,
    content,
    pageNumber,
    chunkIndex: pageNumber,
    tokenCount: 20,
    similarity,
  };
}

interface QueryJson {
  answer: string;
  citations: Citation[];
  confidence: string;
  retrieval: { similarity: number }[];
  message_id?: string;
}
interface MessageJson {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  confidence: string | null;
  createdAt: string;
}
interface ArtifactJson {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  createdAt: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

const ask = (notebookId: string, question: string, documentIds: string[]) =>
  api<QueryJson>(`/notebooks/${notebookId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_ids: documentIds }),
  });

// Notebook A: two answerable documents; notebook B: empty (isolation guard).
seedNotebook('notebook-a', 'Algebra A');
seedNotebook('notebook-b', 'Biology B');
seedDocument('doc-a1', 'notebook-a');
seedDocument('doc-a2', 'notebook-a');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('DoD: answerable questions (1, 2) return grounded answers with citations', async () => {
  nextHits = [hit('doc-a1', 1, 0.8), hit('doc-a2', 2, 0.75)];
  nextAnswer =
    'The chunk size is configured to 500 tokens [Source 1]. The overlap is set to 50 tokens [Source 2].';

  const q1 = await ask('notebook-a', 'What is the chunk size?', ['doc-a1', 'doc-a2']);
  assert.equal(q1.status, 200);
  assert.equal(q1.body.confidence, 'grounded');
  assert.ok(q1.body.answer.includes('[Source 1]'), 'answer is grounded with inline citation');
  assert.ok(q1.body.answer !== 'I could not find information relevant to this question in the provided documents.');
  assert.ok(q1.body.citations.length > 0, 'citations are attributed');
  assert.ok(q1.body.citations.every((c) => c.document_id.startsWith('doc-a')), 'citations point at scoped docs');
  assert.ok(typeof q1.body.message_id === 'string' && q1.body.message_id.length > 0);

  nextAnswer =
    'The separator token is set once at startup [Source 1] and reused for every chunk [Source 2].';
  const q2 = await ask('notebook-a', 'How is the separator applied?', ['doc-a1', 'doc-a2']);
  assert.equal(q2.status, 200);
  assert.equal(q2.body.confidence, 'grounded');
  assert.ok(q2.body.citations.length > 0);
});

test('DoD: out-of-scope questions (3, 4) decline honestly without fabricating', async () => {
  // Best chunk similarity is far below the hard guardrail -> refuse pre-model.
  nextHits = [hit('doc-a1', 1, 0.1), hit('doc-a2', 2, 0.09)];
  nextAnswer = 'SHOULD NOT BE USED — the guardrail must never call the model.';

  for (const question of ['What is the airspeed velocity of an unladen swallow?', 'Who won the 1984 World Series?']) {
    const res = await ask('notebook-a', question, ['doc-a1', 'doc-a2']);
    assert.equal(res.status, 200);
    assert.equal(res.body.confidence, 'not_found');
    assert.deepEqual(res.body.citations, [], 'no citations for out-of-scope questions');
    assert.equal(
      res.body.answer,
      'I could not find information relevant to this question in the provided documents.',
      'honest refusal, no fabricated answer',
    );
    assert.ok(
      res.body.retrieval.every((r) => r.similarity < 0.25),
      'retrieval evidence is genuinely weak',
    );
  }
});

test('DoD: a cross-page synthesis question (5) cites more than one page', async () => {
  nextHits = [hit('doc-a1', 1, 0.8), hit('doc-a1', 3, 0.72)];
  nextAnswer =
    'The chunker first splits by heading [Source 1], then merges short segments [Source 2].';

  const res = await ask('notebook-a', 'How does chunking work across pages?', ['doc-a1']);
  assert.equal(res.status, 200);
  assert.equal(res.body.confidence, 'grounded');
  const pages = new Set(res.body.citations.map((c) => c.page_number));
  assert.ok(pages.size >= 2, `synthesis must cite >= 2 pages, got ${[...pages].join(', ')}`);
  assert.ok(
    [...pages].includes(1) && [...pages].includes(3),
    'citations span the two synthesized pages (1 and 3)',
  );
});

test('DoD: chat history persists and reloads identically (refresh-safe)', async () => {
  seedNotebook('notebook-c', 'History C');
  seedDocument('doc-c1', 'notebook-c', 'ready');

  nextHits = [hit('doc-c1', 1, 0.8)];
  nextAnswer = 'History persists because every exchange is stored [Source 1].';

  const q1 = await ask('notebook-c', 'Does history persist?', ['doc-c1']);
  assert.equal(q1.status, 200);
  const q2 = await ask('notebook-c', 'What about a second question?', ['doc-c1']);
  assert.equal(q2.status, 200);

  const first = await api<MessageJson[]>(`/notebooks/notebook-c/messages`);
  assert.equal(first.status, 200);
  assert.equal(first.body.length, 4, 'two exchanges -> four stored messages');

  assert.deepEqual(
    first.body.map((m) => [m.role, m.content]),
    [
      ['user', 'Does history persist?'],
      ['assistant', 'History persists because every exchange is stored [Source 1].'],
      ['user', 'What about a second question?'],
      ['assistant', 'History persists because every exchange is stored [Source 1].'],
    ],
  );
  const firstAssistant = first.body[1];
  assert.equal(firstAssistant.confidence, 'grounded');
  assert.ok(firstAssistant.citations && firstAssistant.citations.length > 0, 'citations persisted');

  // A page refresh simply re-fetches history — the transcript must be identical.
  const second = await api<MessageJson[]>(`/notebooks/notebook-c/messages`);
  assert.deepEqual(second.body, first.body, 'history reload returns the same transcript');

  // Isolation: notebook B has no chat history of its own.
  const empty = await api<MessageJson[]>(`/notebooks/notebook-b/messages`);
  assert.deepEqual(empty.body, []);

  const ghost = await api<{ error: string }>(`/notebooks/ghost/messages`);
  assert.equal(ghost.status, 404);
});

test('DoD: save-as-note creates a real artifact row retrievable via /:id/artifacts', async () => {
  const history = await api<MessageJson[]>(`/notebooks/notebook-c/messages`);
  const assistant = history.body.find((m) => m.role === 'assistant')!;

  const saved = await api<ArtifactJson>(`/notebooks/notebook-c/messages/${assistant.id}/save-as-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Key finding' }),
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.type, 'saved_note');
  assert.equal(saved.body.title, 'Key finding');
  assert.equal(saved.body.content, assistant.content);
  assert.deepEqual(saved.body.citations, assistant.citations, 'citations copied into the note');

  const artifactsList = await api<ArtifactJson[]>(`/notebooks/notebook-c/artifacts`);
  assert.equal(artifactsList.status, 200);
  assert.ok(
    artifactsList.body.some((a) => a.id === saved.body.id),
    'saved note is retrievable through the artifacts endpoint',
  );

  // Isolation: another notebook cannot see this notebook's notes.
  const other = await api<ArtifactJson[]>(`/notebooks/notebook-b/artifacts`);
  assert.ok(
    !other.body.some((a) => a.id === saved.body.id),
    'notes are scoped to their notebook',
  );

  // Unknown message id -> 404.
  const missing = await api<{ error: string }>(`/notebooks/notebook-c/messages/ghost/save-as-note`, {
    method: 'POST',
  });
  assert.equal(missing.status, 404);

  // User turns are not saveable -> 400.
  const userMsg = history.body.find((m) => m.role === 'user')!;
  const bad = await api<{ error: string }>(`/notebooks/notebook-c/messages/${userMsg.id}/save-as-note`, {
    method: 'POST',
  });
  assert.equal(bad.status, 400);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

after(() => server.close());