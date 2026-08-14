import 'dotenv/config';

/**
 * Phase 2 Definition-of-Done verification — notebook-scoped chat + history + notes.
 *
 * Requires: docent-api running (npm run dev) with SUPABASE + embedding + model
 * env configured, and migrations 001/002/003 applied to the database.
 * Usage:  npm run verify-chat
 * Point at a running docent-api with DOCENT_API_URL (defaults to localhost:3001).
 *
 * Uploads a known-facts text source to a fresh notebook, then proves:
 *   1. answerable questions (2) return grounded answers WITH citations,
 *   2. out-of-scope questions (2) decline honestly (the critical no-fabrication gate),
 *   3. a synthesis question (5) is grounded across multiple cited chunks,
 *   4. chat history persists across a refresh (GET /:id/messages is stable),
 *   5. save-as-note creates a real artifact row retrievable via /:id/artifacts.
 * The notebook is deleted on exit.
 */
const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
}
interface RetrievalInfo {
  source_label: string;
  page_number: number;
  similarity: number;
  snippet: string;
}
interface QueryJson {
  answer: string;
  citations: Citation[];
  confidence: 'grounded' | 'partial' | 'not_found';
  retrieval: RetrievalInfo[];
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
interface Notebook {
  id: string;
  name: string;
  documentCount: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body.error ?? 'unknown error'}`);
  }
  return body;
}

async function pollReady(docId: string, timeoutMs = 90_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let status = 'processing';
  while (Date.now() < deadline) {
    await sleep(1500);
    const doc = await api<{ id: string; status: string }>(`/documents/${docId}/status`);
    status = doc.status;
    if (status !== 'processing') break;
  }
  return status;
}

function report(ok: boolean, label: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const SOURCE_TEXT = [
  'Docent is a document-grounded RAG platform.',
  'The chunking configuration targets a chunk size of 500 tokens.',
  'The overlap between adjacent chunks is 50 tokens.',
  'The separator token is set once at startup and reused for every chunk.',
  'The default embedding model is text-embedding-004 with 1536 dimensions.',
  'Retrieval re-ranks the top 8 candidates and keeps the top 4 for generation.',
  'Every answer must cite its sources inline using [Source N] labels.',
].join(' ');

interface TestCase {
  id: string;
  question: string;
  kind: 'answerable' | 'out-of-scope' | 'synthesis';
}

const CASES: TestCase[] = [
  { id: 'Q1-answerable', question: 'What chunk size does Docent target?', kind: 'answerable' },
  {
    id: 'Q2-answerable',
    question: 'How many dimensions do the embedding vectors have?',
    kind: 'answerable',
  },
  { id: 'Q3-out-of-scope', question: 'What is the capital of France?', kind: 'out-of-scope' },
  { id: 'Q4-out-of-scope', question: 'Who is the CEO of Tesla?', kind: 'out-of-scope' },
  {
    id: 'Q5-synthesis',
    question: 'Describe Docent\u2019s chunking and retrieval strategy.',
    kind: 'synthesis',
  },
];

function evaluate(kind: TestCase['kind'], result: QueryJson): string[] {
  const issues: string[] = [];
  switch (kind) {
    case 'answerable':
      if (result.confidence === 'not_found') issues.push('expected an answer but got not_found');
      if (result.citations.length === 0) issues.push('expected inline citations but found none');
      break;
    case 'out-of-scope':
      // The critical DoD check: never a confident fabricated answer.
      if (result.confidence === 'grounded') {
        issues.push(`CRITICAL: fabricated a confident answer (grounded) — ${result.answer}`);
      }
      if (result.citations.length > 0) issues.push('should have no citations but cited sources');
      break;
    case 'synthesis':
      if (result.confidence === 'not_found') issues.push('expected synthesis but got not_found');
      // Strict cross-page spanning is asserted in the automated chat.api.test.ts;
      // live here we require grounding across >= 2 distinct cited chunks.
      if (result.citations.length < 2) issues.push('expected >= 2 cited chunks for synthesis');
      break;
  }
  return issues;
}

async function main(): Promise<void> {
  const tag = Date.now();
  console.log(`API: ${API_URL}\n`);

  const notebook: Notebook = await api('/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Verify Chat ${tag}` }),
  });
  console.log(`Notebook: ${notebook.id}\n`);

  const textDoc = await api<{ id: string }>(`/notebooks/${notebook.id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Docent facts ${tag}`, content: SOURCE_TEXT }),
  });
  console.log(`Uploaded text source -> ${textDoc.id}`);

  const status = await pollReady(textDoc.id);
  console.log(`Ingestion status: ${status}\n`);
  if (status !== 'ready') {
    throw new Error(`Source did not finish ingesting (status=${status}). Aborting.`);
  }
  const documentIds = [textDoc.id];

  let casePass = 0;
  const results: Array<{ id: string; ok: boolean; issues: string[] }> = [];
  const assistantMessageIds: string[] = [];

  for (const c of CASES) {
    console.log(`\n======== ${c.id} (${c.kind}) ========`);
    console.log(`Q: ${c.question}`);
    let result: QueryJson;
    try {
      result = await api<QueryJson>(`/notebooks/${notebook.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: c.question, document_ids: documentIds }),
      });
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      results.push({ id: c.id, ok: false, issues: ['request failed'] });
      continue;
    }

    console.log(`confidence: ${result.confidence}`);
    console.log(
      `citations: ${result.citations.length} ${JSON.stringify(result.citations.map((x) => `${x.source_label}@p${x.page_number}`))}`,
    );
    console.log(`A: ${result.answer.slice(0, 220)}${result.answer.length > 220 ? '…' : ''}`);
    if (result.message_id) assistantMessageIds.push(result.message_id);

    const issues = evaluate(c.kind, result);
    const ok = issues.length === 0;
    results.push({ id: c.id, ok, issues });
    console.log(ok ? 'PASS' : `FAIL — ${issues.join('; ')}`);
    if (ok) casePass += 1;
  }

  // ---- 4. History persistence (refresh-safe) ----
  console.log('\n======== Chat history persistence ========');
  const history1 = await api<MessageJson[]>(`/notebooks/${notebook.id}/messages`);
  const history2 = await api<MessageJson[]>(`/notebooks/${notebook.id}/messages`);
  const pairs = history1.filter((m) => m.role === 'assistant').length;
  const historyStable = JSON.stringify(history1) === JSON.stringify(history2);
  const historyMatches = history1.length >= 2 * CASES.length;
  const historyPersists = historyStable && historyMatches && pairs === CASES.length;
  report(historyStable, 'Two consecutive GET /:id/messages return an identical transcript');
  report(historyMatches, `Transcript contains ${history1.length} rows (expected ${CASES.length * 2})`);
  report(pairs === CASES.length, `Transcript contains ${pairs} assistant answers (one per question)`);

  // ---- 5. Save-as-note -> artifact ----
  console.log('\n======== Save-as-note -> artifacts ========');
  let noteCreated = false;
  let noteContentMatches = false;
  if (assistantMessageIds.length > 0) {
    const target = assistantMessageIds[0];
    const note = await api<ArtifactJson>(`/notebooks/${notebook.id}/messages/${target}/save-as-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Verified note' }),
    });
    noteCreated = note.type === 'saved_note';
    const artifacts = await api<ArtifactJson[]>(`/notebooks/${notebook.id}/artifacts`);
    const found = artifacts.find((a) => a.id === note.id);
    noteContentMatches = Boolean(found && found.content === note.content && found.citations?.length === note.citations?.length);
    report(noteCreated, `save-as-note created artifact type=${note.type} (${note.id})`);
    report(noteContentMatches, 'Artifact is retrievable via /:id/artifacts with content + citations intact');
  } else {
    report(false, 'No assistant message ids available to save as a note');
  }

  // ---- Cleanup ----
  console.log('\n======== Cleanup ========');
  await api(`/notebooks/${notebook.id}`, { method: 'DELETE' });
  const gone = await api<{ error?: string }>(`/notebooks/${notebook.id}`).catch(() => null);
  const cleaned = !gone;
  report(cleaned, 'Notebook deleted; GET returns 404');

  const allPass = casePass === CASES.length && historyPersists && noteCreated && noteContentMatches && cleaned;
  console.log('\n========================================');
  console.log(`SUMMARY: ${allPass ? 'PASS' : 'FAIL'}`);
  for (const r of results) {
    if (!r.ok) console.log(`  FAIL ${r.id}: ${r.issues.join('; ')}`);
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});