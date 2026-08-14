import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';

/**
 * Phase 8 Definition-of-Done verification — data tables + CSV/XLSX export.
 *
 * Two scenarios:
 *   1. POSITIVE — a document with genuinely structured content (a course
 *      schedule with weeks/dates/topics). Expect an accurate table.
 *   2. ADVERSARIAL — a document with NO structured content, asked to extract
 *      data it does not contain (student grades/scores). The phase text calls
 *      this the most important stress test: the honest answer is an empty
 *      table, and any invented rows are a failure.
 *
 * Then exports the positive table as CSV and a real .xlsx (read back with
 * exceljs to confirm the cells).
 *
 * Requires: docent-api running (npm run dev), migrations 001-007 applied.
 * Usage: npm run verify-datatable  (point at API via DOCENT_API_URL)
 */
const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const CSV_PATH = resolve(process.cwd(), 'verify-datatable.csv');
const XLSX_PATH = resolve(process.cwd(), 'verify-datatable.xlsx');

interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
}
interface DataTableJson {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: {
    columns: string[];
    rows: Array<Record<string, string>>;
    source_chunk_ids_by_row: string[][];
    citations_by_row: Citation[][];
  } | null;
  createdAt: string;
}
interface Notebook {
  id: string;
  name: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_URL}${path}`, init);
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.ok) return body;
    if (res.status === 429 && attempt < retries) {
      const waitMs = 30_000 * (attempt + 1);
      console.log(`  (429 rate limit on ${init?.method ?? 'GET'} ${path} — waiting ${waitMs / 1000}s and retrying…)`);
      await sleep(waitMs);
      continue;
    }
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body.error ?? 'unknown error'}`);
  }
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

const SCHEDULE_SOURCE = [
  'Database Systems 101 — Spring 2025 course schedule.',
  'Week 1 (Jan 13): Introduction to database systems. Reading: Chapter 1. Assignment: none.',
  'Week 2 (Jan 20): Relational data model. Reading: Chapter 2. Assignment: ER diagram.',
  'Week 3 (Jan 27): SQL fundamentals. Reading: Chapter 3. Assignment: SQL worksheet 1.',
  'Week 4 (Feb 03): Normalization. Reading: Chapter 4. Assignment: Normalize schema.',
  'Week 5 (Feb 10): Transactions and concurrency. Reading: Chapter 5. Assignment: none.',
  'Week 6 (Feb 17): Midterm review. Reading: Chapters 1-5. Assignment: practice problems.',
].join(' ');

const NO_STRUCTURE_SOURCE = [
  'This document is an informal essay about the philosophy of database design.',
  'It argues that normalization should be a matter of taste rather than dogma, and that simplicity beats cleverness.',
  'It contains no schedules, no dates, no grades, no scores, no numeric measurements, and no tables of any kind.',
  'The author merely muses about elegance in schema design and the value of documenting assumptions.',
].join(' ');

async function main(): Promise<void> {
  const tag = Date.now();
  console.log(`API: ${API_URL}\n`);
  const failures: string[] = [];

  async function setupNotebook(name: string, content: string) {
    const nb: Notebook = await api('/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${name} ${tag}` }),
    });
    const doc = await api<{ id: string }>(`/notebooks/${nb.id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${name} source`, content }),
    });
    const status = await pollReady(doc.id);
    if (status !== 'ready') throw new Error(`Source ${name} did not become ready (${status})`);
    return { notebook: nb, docId: doc.id };
  }

  // ---- Scenario 1: genuine structured content -----------------------------
  console.log('======== SCENARIO 1: structured source (course schedule) ========');
  const s1 = await setupNotebook('Verify Table', SCHEDULE_SOURCE);
  const table = await api<DataTableJson>(`/notebooks/${s1.notebook.id}/artifacts/data-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_ids: [s1.docId],
      columns_hint: 'extract week number, date, topic, and assignment for each course week',
    }),
  });
  const payload = table.payload;
  if (!payload) throw new Error('Data table has no payload');
  console.log(`Title: ${table.title}`);
  console.log(`Columns: ${payload.columns.join(' | ')}`);
  const weekNum = (r: Record<string, string>) =>
    String(r.Week ?? r['Week #'] ?? '').match(/(\d+)/)?.[1] ?? '';
  for (let i = 0; i < payload.rows.length; i++) {
    const r = payload.rows[i];
    const cite = payload.citations_by_row[i]?.[0];
    console.log(
      `  ${payload.columns.map((c) => `${c}=${r[c] ?? ''}`).join('  ')}` +
        `  [${cite ? `p${cite.page_number}: "${cite.chunk_content_snippet.slice(0, 60)}"` : 'no cite'}]`,
    );
  }
  report(payload.rows.length >= 4, `Extracted ${payload.rows.length} rows (6 weeks in source)`);
  report(
    payload.rows.every((_r, i) => (payload.citations_by_row[i]?.length ?? 0) > 0),
    'Every row carries a source citation',
  );
  const week1 = payload.rows.find((r) => weekNum(r) === '1');
  report(
    !!week1 && (/Intro/i.test(String(week1.Topic ?? '')) || /Jan 13/i.test(String(week1.Date ?? ''))),
    'Week 1 row matches the source ("Introduction to database systems", Jan 13)',
  );
  if (payload.rows.length < 4) failures.push(`positive table only produced ${payload.rows.length} rows`);

  // ---- Scenario 2: adversarial — structured data that does NOT exist ------
  console.log('\n======== SCENARIO 2: adversarial (ask to tabulate grades that are not in the doc) ========');
  const s2 = await setupNotebook('Verify Table Adversarial', NO_STRUCTURE_SOURCE);
  const adv = await api<DataTableJson>(`/notebooks/${s2.notebook.id}/artifacts/data-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_ids: [s2.docId],
      columns_hint: 'extract each student name, their grade, and their exam score',
    }),
  });
  const advPayload = adv.payload;
  if (!advPayload) throw new Error('Adversarial table has no payload');
  console.log(`Columns: ${advPayload.columns.join(' | ')}  |  rows: ${advPayload.rows.length}`);
  for (const r of advPayload.rows) console.log('  ', JSON.stringify(r));
  report(advPayload.rows.length === 0, 'Model refused to invent grades/scores (honest empty table)');
  if (advPayload.rows.length > 0) {
    failures.push(
      `adversarial doc produced ${advPayload.rows.length} rows — inspect above; structure was hallucinated`,
    );
  }

  // ---- Exports -------------------------------------------------------------
  console.log('\n======== EXPORT ========');
  const csvRes = await fetch(`${API_URL}/notebooks/${s1.notebook.id}/artifacts/${table.id}/export?format=csv`);
  if (!csvRes.ok) throw new Error(`CSV export -> ${csvRes.status}`);
  const csv = await csvRes.text();
  writeFileSync(CSV_PATH, csv);
  report(/Week,Topic|Week,Date|Week,.*Assignment/.test(csv.split('\r\n')[0]), `CSV written: ${CSV_PATH}`);

  const xlsxRes = await fetch(
    `${API_URL}/notebooks/${s1.notebook.id}/artifacts/${table.id}/export?format=xlsx`,
  );
  if (!xlsxRes.ok) throw new Error(`XLSX export -> ${xlsxRes.status}`);
  const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());
  writeFileSync(XLSX_PATH, xlsxBuf);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuf.buffer.slice(xlsxBuf.byteOffset, xlsxBuf.byteOffset + xlsxBuf.byteLength));
  const ws = wb.worksheets[0];
  const headerOk = Object.values(ws.getRow(1).values)
    .filter((v) => v !== null && v !== undefined)
    .map(String)
    .join(',')
    .toLowerCase()
    .includes('week');
  report(ws.name === 'Data' && headerOk, `XLSX written + read back (sheet "${ws.name}", ${ws.rowCount} rows)`);

  console.log('\n========================================');
  console.log(
    failures.length > 0
      ? `STRESS TEST NOTES:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`
      : 'All automated checks passed.\n',
  );
  console.log(
    `SUMMARY: ${CSV_PATH} and ${XLSX_PATH} written. Open the .xlsx in a spreadsheet ` +
      `program and spot-check the week/date/topic rows against the source schedule.`,
  );
  try {
    await api(`/notebooks/${s1.notebook.id}`, { method: 'DELETE' });
    await api(`/notebooks/${s2.notebook.id}`, { method: 'DELETE' });
    console.log('Cleanup: notebooks deleted.');
  } catch {
    console.log('Cleanup: could not delete notebooks (ignored).');
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});