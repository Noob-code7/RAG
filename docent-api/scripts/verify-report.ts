import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 6 Definition-of-Done verification — report/study guide + PDF export.
 * Generates a report from a real document, then downloads it as both Markdown
 * and a real (Chromium-rendered) PDF. Print the PDF and confirm:
 *   - headings/paragraphs render as a clean, readable document (not raw HTML),
 *   - citation markers are visible next to the claims they support.
 *
 * Requires: docent-api running (npm run dev) with SUPABASE + embedding + model
 * env configured, and migrations 001-006 applied.
 * Usage:  npm run verify-report
 * Point at a running docent-api with DOCENT_API_URL (defaults to localhost:3001).
 * The notebook is deleted on exit; the PDF is written to ./verify-report.pdf.
 */
const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const PDF_PATH = resolve(process.cwd(), 'verify-report.pdf');
const MD_PATH = resolve(process.cwd(), 'verify-report.md');

interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
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
  'The target chunk size for a Docent index is 500 tokens.',
  'Adjacent chunks overlap by 50 tokens so no fact is split at a boundary.',
  'Chunks are embedded with text-embedding-004 producing 1536 dimensions.',
  'Retrieval re-ranks the top 8 candidates and keeps the top 4 for the prompt.',
  'Answers must cite every claim inline using [Source N] labels.',
  'The separator token is fixed once at startup and reused for every chunk.',
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
    body: JSON.stringify({ name: `Verify Report ${tag}` }),
  });
  const doc = await api<{ id: string }>(`/notebooks/${notebook.id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Docent facts ${tag}`, content: SOURCE_TEXT }),
  });
  const status = await pollReady(doc.id);
  console.log(`Notebook: ${notebook.id}  doc: ${doc.id}  status: ${status}\n`);
  if (status !== 'ready') throw new Error(`Source did not become ready (${status})`);

  const reportArtifact = await api<ArtifactJson>(`/notebooks/${notebook.id}/artifacts/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: [doc.id], focus: 'Docent chunking and retrieval pipeline' }),
  });

  console.log('======== REPORT MARKDOWN (generated) ========');
  console.log(reportArtifact.content);
  console.log('\n======== CITATIONS (inline markers -> source text) ========');
  for (const c of reportArtifact.citations ?? []) {
    console.log(`- ${c.source_label}  p${c.page_number}: "${c.chunk_content_snippet.slice(0, 110)}${c.chunk_content_snippet.length > 110 ? '…' : ''}"`);
  }

  const content = reportArtifact.content ?? '';
  const hasHeading = /^#{1,6}\s+\S/m.test(content);
  const hasBody = content.replace(/^#{1,6}.*$/gm, '').trim().length >= 200;
  const citations = reportArtifact.citations ?? [];
  const markerCount = (content.match(/\[Source\s+\d+\]/g) ?? []).length;
  report(hasHeading, 'Report has Markdown headings');
  report(hasBody, 'Report has substantive body prose');
  report(markerCount >= 3, `Report embeds ${markerCount} inline [Source N] markers`);
  report(citations.length >= 1, `${citations.length} citations resolved to real chunks`);
  report(
    citations.every((c) => c.chunk_content_snippet.length > 0),
    'Every citation exposes supporting source text',
  );

  console.log('\n======== EXPORT MD ========');
  const mdRes = await fetch(`${API_URL}/notebooks/${notebook.id}/artifacts/${reportArtifact.id}/export?format=md`);
  if (!mdRes.ok) throw new Error(`MD export -> ${mdRes.status}`);
  writeFileSync(MD_PATH, await mdRes.text());
  console.log(`Wrote ${MD_PATH} (${mdRes.headers.get('content-disposition') ?? ''})`);

  console.log('\n======== EXPORT PDF ========');
  const pdfRes = await fetch(`${API_URL}/notebooks/${notebook.id}/artifacts/${reportArtifact.id}/export?format=pdf`);
  if (!pdfRes.ok) throw new Error(`PDF export -> ${pdfRes.status}`);
  const pdf = Buffer.from(await pdfRes.arrayBuffer());
  writeFileSync(PDF_PATH, pdf);
  const cd = pdfRes.headers.get('content-disposition') ?? '';
  const isPdf = pdf.length > 4 && pdf.subarray(0, 4).toString('ascii') === '%PDF';
  report(isPdf, `PDF downloaded: ${(pdf.length / 1024).toFixed(1)} KiB, header %PDF`);
  report(/filename=".+\.pdf"/.test(cd), `Content-Disposition sets a .pdf filename (${cd})`);
  console.log(`Wrote ${PDF_PATH}\n`);

  console.log('========================================');
  console.log(
    `SUMMARY: open ${PDF_PATH} and confirm headings/paragraphs render as a clean, ` +
      `readable document and that the citation markers are visible.`,
  );
  try {
    await api(`/notebooks/${notebook.id}`, { method: 'DELETE' });
    console.log('Cleanup: notebook deleted.');
  } catch {
    console.log('Cleanup: could not delete notebook (ignored).');
  }
  process.exit(hasHeading && hasBody && markerCount >= 3 && citations.length >= 1 && isPdf ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
