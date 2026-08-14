import 'dotenv/config';

/**
 * Manual verification script for Phase 2 (POST /query).
 *
 * Requirements to run:
 *   1. docent-api running (npm run dev) with SUPABASE + OPENAI env configured,
 *      and at least one document ingested (use sample-data/sample-rag-notes.pdf).
 *   2. Optionally point DOCENT_API_URL at a different host.
 *   3. Optionally pin the document with DOCUMENT_ID; otherwise the first
 *      'ready' document is used.
 *
 * The 5 questions exercise the two behaviours that matter:
 *   Q1/Q2  -> answerable (should be grounded/partial WITH citations)
 *   Q3/Q4  -> clearly out of scope (MUST NOT produce a confident fabricated
 *             answer — the most important check in the whole project)
 *   Q5     -> synthesis across two different pages (chunking/retrieval breadth)
 */

const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DOCUMENT_ID = process.env.DOCUMENT_ID ?? '';

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
interface QueryResponse {
  answer: string;
  citations: Citation[];
  confidence: 'grounded' | 'partial' | 'not_found';
  retrieval: RetrievalInfo[];
}

interface TestCase {
  id: string;
  question: string;
  kind: 'answerable' | 'out-of-scope' | 'synthesis';
}

const CASES: TestCase[] = [
  {
    id: 'Q1-answerable',
    question: 'What chunk size does Docent target, and how much overlap does it use between chunks?',
    kind: 'answerable',
  },
  {
    id: 'Q2-answerable',
    question: 'Which embedding model does Docent use and how many dimensions do its vectors have?',
    kind: 'answerable',
  },
  {
    id: 'Q3-out-of-scope',
    question: 'What is the capital of France?',
    kind: 'out-of-scope',
  },
  {
    id: 'Q4-out-of-scope',
    question: 'Who is the CEO of Tesla?',
    kind: 'out-of-scope',
  },
  {
    id: 'Q5-synthesis',
    question:
      'Docent says it is different from a naive chat wrapper. What does it actually do to make its answers trustworthy?',
    kind: 'synthesis',
  },
];

async function resolveDocumentIds(): Promise<string[]> {
  if (DOCUMENT_ID) return [DOCUMENT_ID];
  const res = await fetch(`${API_URL}/documents`);
  if (!res.ok) throw new Error(`GET /documents failed: ${res.status}`);
  const docs = (await res.json()) as Array<{ id: string; status: string }>;
  const ready = docs.filter((d) => d.status === 'ready');
  if (ready.length === 0) {
    throw new Error(
      'No ready documents found. Ingest a PDF first (e.g. sample-data/sample-rag-notes.pdf via POST /documents).',
    );
  }
  return [ready[0].id];
}

async function ask(question: string, documentIds: string[]): Promise<QueryResponse> {
  const res = await fetch(`${API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_ids: documentIds }),
  });
  if (!res.ok) {
    throw new Error(`POST /query failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as QueryResponse;
}

function evaluate(kind: TestCase['kind'], result: QueryResponse): string[] {
  const issues: string[] = [];
  const citedPages = new Set(result.citations.map((c) => c.page_number));
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
      if (result.confidence === 'not_found') issues.push('expected synthesis across pages but got not_found');
      if (citedPages.size < 2) issues.push(`expected citations spanning >1 page, got pages [${[...citedPages]}]`);
      break;
  }
  return issues;
}

async function main(): Promise<void> {
  const documentIds = await resolveDocumentIds();
  console.log(`API: ${API_URL}\nDocument IDs: ${documentIds.join(', ')}\n`);

  let pass = 0;
  const results: Array<{ id: string; ok: boolean; issues: string[]; result: QueryResponse }> = [];

  for (const c of CASES) {
    console.log(`\n======== ${c.id} (${c.kind}) ========`);
    console.log(`Q: ${c.question}`);
    let result: QueryResponse;
    try {
      result = await ask(c.question, documentIds);
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      results.push({ id: c.id, ok: false, issues: ['request failed'], result: undefined as unknown as QueryResponse });
      continue;
    }

    console.log(`confidence: ${result.confidence}`);
    console.log(`citations: ${result.citations.length} ${JSON.stringify(result.citations.map((x) => `${x.source_label}@p${x.page_number}`))}`);
    console.log(`top retrieval: ${result.retrieval.slice(0, 4).map((r) => `${r.source_label} sim=${r.similarity.toFixed(3)} p${r.page_number}`).join(' | ')}`);
    console.log(`A: ${result.answer.slice(0, 300)}${result.answer.length > 300 ? '…' : ''}`);

    const issues = evaluate(c.kind, result);
    const ok = issues.length === 0;
    results.push({ id: c.id, ok, issues, result });
    console.log(ok ? 'PASS' : `FAIL — ${issues.join('; ')}`);
    if (ok) pass += 1;
  }

  console.log('\n========================================');
  console.log(`SUMMARY: ${pass}/${results.length} passed`);
  for (const r of results) {
    if (!r.ok) console.log(`  FAIL ${r.id}: ${r.issues.join('; ')}`);
  }
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});