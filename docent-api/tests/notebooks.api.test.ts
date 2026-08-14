import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Phase 1 Definition-of-Done — notebooks + multi-document ingestion.
 *
 * Boots the real Express routers in-process with a fake database (and no-op
 * storage/embedding/PDF layers) so the DoD can be proven under `npm test`
 * without a live Supabase project:
 *   1. create two notebooks,
 *   2. upload a different PDF to each,
 *   3. confirm via the API that a document in Notebook A never appears in
 *      Notebook B's document list (and vice versa).
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
  filename: string;
  source_type: string;
  uploaded_at: string;
  status: string;
  page_count: number | null;
  progress: number;
  error: string | null;
  storage_path: string | null;
  content: string | null;
}

const notebooks = new Map<string, MemNotebook>();
const documents = new Map<string, MemDocument>();
let seq = 0;
const uuid = () => `mock-${++seq}`;
const ts = () => new Date(1_700_000_000_000 + seq * 1000).toISOString();

async function fakeQuery<T>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  if (text.includes('insert into notebooks')) {
    const id = uuid();
    const nb: MemNotebook = {
      id,
      name: String(params[0]),
      created_at: ts(),
      updated_at: ts(),
    };
    notebooks.set(id, nb);
    return { rows: [nb as unknown as T] };
  }

  if (text.includes('insert into documents')) {
    const [notebookId, filename, sourceType, content] = params as [string, string, string, string | null];
    const id = uuid();
    documents.set(id, {
      id,
      notebook_id: notebookId,
      filename,
      source_type: sourceType,
      uploaded_at: ts(),
      status: 'processing',
      page_count: null,
      progress: 0,
      error: null,
      storage_path: null,
      content,
    });
    return { rows: [{ id } as unknown as T] };
  }

  if (text.includes('insert into chunks')) return { rows: [] };

  if (text.includes('update documents set storage_path')) {
    const doc = documents.get(String(params[0]));
    if (doc) doc.storage_path = String(params[1]);
    return { rows: [] };
  }
  if (text.includes('update documents set page_count')) {
    const doc = documents.get(String(params[0]));
    if (doc) doc.page_count = Number(params[1]);
    return { rows: [] };
  }
  if (text.includes("set status = 'failed'")) {
    const doc = documents.get(String(params[0]));
    if (doc) {
      doc.status = 'failed';
      doc.error = String(params[1]);
    }
    return { rows: [] };
  }
  if (text.includes("set status = 'ready'")) {
    const doc = documents.get(String(params[0]));
    if (doc) {
      doc.status = 'ready';
      doc.progress = 1;
    }
    return { rows: [] };
  }
  if (text.includes('update documents set progress')) {
    const doc = documents.get(String(params[0]));
    if (doc) doc.progress = Number(params[1]);
    return { rows: [] };
  }

  if (text.includes('update notebooks set name')) {
    const nb = notebooks.get(String(params[0]));
    if (nb) {
      nb.name = String(params[1]);
      nb.updated_at = ts();
    }
    return { rows: [] };
  }

  if (text.includes('delete from notebooks')) {
    const id = String(params[0]);
    notebooks.delete(id);
    for (const [docId, doc] of [...documents]) {
      if (doc.notebook_id === id) documents.delete(docId);
    }
    return { rows: [] };
  }

  if (text.includes('select storage_path from documents where notebook_id')) {
    const rows = [...documents.values()]
      .filter((d) => d.notebook_id === String(params[0]))
      .map((d) => ({ storage_path: d.storage_path }));
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('select id from notebooks where id = $1')) {
    const nb = notebooks.get(String(params[0]));
    return { rows: (nb ? [{ id: nb.id }] : []) as unknown as T[] };
  }

  if (text.includes('count(d.id)')) {
    const single = text.includes('where n.id = $1');
    const list = [...notebooks.values()].filter((n) => (single ? n.id === String(params[0]) : true));
    const rows = list.map((n) => ({
      ...n,
      document_count: [...documents.values()].filter((d) => d.notebook_id === n.id).length,
    }));
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('from documents where notebook_id')) {
    const rows = [...documents.values()]
      .filter((d) => d.notebook_id === String(params[0]))
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    return { rows: rows as unknown as T[] };
  }

  if (text.includes('from documents where id = $1')) {
    const doc = documents.get(String(params[0]));
    return { rows: (doc ? [doc] : []) as unknown as T[] };
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
mockTs('db/storage.ts', {
  uploadDocumentFile: async (docId: string) => `documents/${docId}.pdf`,
  downloadDocumentFile: async () => Buffer.from('%PDF-1.4 fake'),
  deleteDocumentFiles: async () => undefined,
});
mockTs('services/embeddings/embeddingClient.ts', {
  embedTexts: async (texts: string[]) => texts.map(() => [0.1]),
});
mockTs('services/ingestion/pdfExtractor.ts', {
  extractPdfPages: async () => [
    { pageNumber: 1, text: 'Sample notebook A content that is sufficiently long to pass extraction.' },
  ],
  hasExtractableText: () => true,
});

const { default: notebooksRouter } = await import('../src/routes/notebooks.js');
const { default: documentsRouter } = await import('../src/routes/documents.js');
const { default: express } = await import('express');

const app = express();
app.use(express.json());
app.use('/notebooks', notebooksRouter);
app.use('/documents', documentsRouter);

const server = app.listen(0);
await once(server, 'listening');
const address = server.address();
const baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 3001}`;

interface NotebookJson {
  id: string;
  name: string;
  documentCount: number;
}
interface DocJson {
  id: string;
  notebookId: string;
  filename: string;
  sourceType: string;
  status: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

const createNotebook = (name: string) =>
  api<NotebookJson>('/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

const uploadPdf = (notebookId: string, filename: string) => {
  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' }), filename);
  return api<DocJson>(`/notebooks/${notebookId}/documents`, { method: 'POST', body: form });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('POST /notebooks creates notebooks with distinct ids', async () => {
  const a = await createNotebook('Algebra A');
  const b = await createNotebook('Biology B');
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.id, b.body.id);
  assert.equal(a.body.name, 'Algebra A');
  assert.equal(a.body.documentCount, 0);
});

test('DoD: documents in Notebook A never appear in Notebook B (and vice versa)', async () => {
  const a = await createNotebook('Isolation A');
  const b = await createNotebook('Isolation B');
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);

  const pdfA = await uploadPdf(a.body.id, 'algebra-notes.pdf');
  const pdfB = await uploadPdf(b.body.id, 'biology-notes.pdf');
  assert.equal(pdfA.status, 202);
  assert.equal(pdfB.status, 202);

  const listA = await api<DocJson[]>(`/notebooks/${a.body.id}/documents`);
  const listB = await api<DocJson[]>(`/notebooks/${b.body.id}/documents`);

  assert.equal(listA.status, 200);
  assert.equal(listB.status, 200);

  const idsA = new Set(listA.body.map((d) => d.id));
  const idsB = new Set(listB.body.map((d) => d.id));

  assert.ok(idsA.has(pdfA.body.id), 'Notebook A lists its own PDF');
  assert.ok(idsB.has(pdfB.body.id), 'Notebook B lists its own PDF');
  assert.ok(!idsA.has(pdfB.body.id), 'Notebook A must NOT list Notebook B\u2019s document');
  assert.ok(!idsB.has(pdfA.body.id), 'Notebook B must NOT list Notebook A\u2019s document');

  // Document rows are tagged with their owning notebook.
  assert.equal(listA.body[0].notebookId, a.body.id);
  assert.equal(listB.body[0].notebookId, b.body.id);
});

test('pasted-text sources are stored as documents in the owning notebook', async () => {
  const nb = await createNotebook('Text Notebook');
  const res = await api<DocJson>(`/notebooks/${nb.body.id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Past notes',
      content: 'Some pasted research notes for the text source test.',
    }),
  });
  assert.equal(res.status, 202);
  assert.equal(res.body.sourceType, 'text');
  assert.equal(res.body.notebookId, nb.body.id);

  const list = await api<DocJson[]>(`/notebooks/${nb.body.id}/documents`);
  assert.ok(list.body.some((d) => d.id === res.body.id));
});

test('PATCH renames and DELETE removes a notebook (default is protected)', async () => {
  const created = await createNotebook('Rename Me');
  const renamed = await api<NotebookJson>(`/notebooks/${created.body.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed' }),
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, 'Renamed');

  const deleted = await api<{ ok: boolean }>(`/notebooks/${created.body.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { ok: true });

  const gone = await api<{ error: string }>(`/notebooks/${created.body.id}`);
  assert.equal(gone.status, 404);

  // The default notebook used by the legacy /documents endpoints is protected.
  const forbidden = await api<{ error: string }>(
    `/notebooks/00000000-0000-0000-0000-000000000000`,
    { method: 'DELETE' },
  );
  assert.equal(forbidden.status, 409);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

after(() => server.close());
