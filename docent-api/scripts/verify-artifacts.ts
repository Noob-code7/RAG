import 'dotenv/config';

/**
 * Phase 4 Definition-of-Done verification — flashcards + quizzes from a real
 * document. Prints the generated cards/questions alongside the exact source
 * text they were generated from, so the DoD spot-check (verify ~5 items
 * manually against the source) can be done in one pass.
 *
 * Requires: docent-api running (npm run dev) with SUPABASE + embedding + model
 * env configured, and migrations 001/002/003/004 applied.
 * Usage:  npm run verify-artifacts
 * Point at a running docent-api with DOCENT_API_URL (defaults to localhost:3001).
 *
 * The notebook is deleted on exit.
 */
const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
}
interface FlashcardItem {
  question: string;
  answer: string;
  source_chunk_ids: string[];
  citations: Citation[];
}
interface QuizItem {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source_chunk_ids: string[];
  citations: Citation[];
}
interface ArtifactJson {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: FlashcardItem[] | QuizItem[] | null;
  createdAt: string;
}
interface Notebook {
  id: string;
  name: string;
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

const SOURCE_TEXT = [
  'Docent chunking: the target chunk size is 500 tokens.',
  'Adjacent chunks overlap by 50 tokens so no fact is split at a boundary.',
  'The separator token is set once at startup and reused for every chunk.',
  'Chunks are embedded with text-embedding-004 producing 1536 dimensions.',
  'Retrieval re-ranks the top 8 candidates and keeps the top 4 for the prompt.',
  'Answers must cite every claim inline using [Source N] labels.',
].join(' ');

function report(ok: boolean, label: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

async function main(): Promise<void> {
  const tag = Date.now();
  console.log(`API: ${API_URL}\n`);

  const notebook: Notebook = await api('/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Verify Artifacts ${tag}` }),
  });
  const doc = await api<{ id: string }>(`/notebooks/${notebook.id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Docent facts ${tag}`, content: SOURCE_TEXT }),
  });
  const status = await pollReady(doc.id);
  console.log(`Notebook: ${notebook.id}  doc: ${doc.id}  status: ${status}\n`);
  if (status !== 'ready') throw new Error(`Source did not become ready (${status})`);
  const documentIds = [doc.id];

  const cards = await api<ArtifactJson>(`/notebooks/${notebook.id}/artifacts/flashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds, topic: 'Docent chunking and retrieval', difficulty: 'medium', count: 5 }),
  });
  const quiz = await api<ArtifactJson>(`/notebooks/${notebook.id}/artifacts/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds, topic: 'Docent embeddings', difficulty: 'easy', count: 4 }),
  });

  console.log('======== SOURCE (what the model was given) ========');
  console.log(SOURCE_TEXT);
  console.log('\n======== FLASHCARDS (verify each card against the source) ========');
  const flashItems = (cards.payload ?? []) as FlashcardItem[];
  report(flashItems.length >= 5, `Generated ${flashItems.length} flashcards (expected >= 5)`);
  flashItems.forEach((c, i) => {
    console.log(`\nCard ${i + 1}: ${c.question}`);
    console.log(`  Answer: ${c.answer}`);
    console.log(`  Cites: ${c.citations.map((x) => `[${x.document_id.slice(0, 8)} p${x.page_number}]`).join(', ')}`);
  });

  console.log('\n======== QUIZ (verify each question + correct answer against the source) ========');
  const quizItems = (quiz.payload ?? []) as QuizItem[];
  report(quizItems.length >= 4, `Generated ${quizItems.length} questions (expected >= 4)`);
  quizItems.forEach((q, i) => {
    console.log(`\nQ${i + 1}: ${q.question}`);
    q.options.forEach((opt, oi) => {
      console.log(`   ${oi === q.correct_index ? '✔' : ' '} ${oi}. ${opt}`);
    });
    console.log(`  Explanation: ${q.explanation}`);
    console.log(`  Cites: ${q.citations.map((x) => `[${x.document_id.slice(0, 8)} p${x.page_number}]`).join(', ')}`);
  });

  console.log('\n======== Cleanup ========');
  await api(`/notebooks/${notebook.id}`, { method: 'DELETE' });
  console.log('PASS  Notebook deleted');

  const itemCount = flashItems.length + quizItems.length;
  console.log('\n========================================');
  console.log(
    `SUMMARY: generated ${flashItems.length} flashcards + ${quizItems.length} quiz questions. ` +
      `Spot-check ~5 items above against the SOURCE to confirm they are grounded.`,
  );
  process.exit(flashItems.length > 0 && quizItems.length > 0 && itemCount >= 5 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});