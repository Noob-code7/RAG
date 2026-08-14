import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Upload every PDF in sample-data/ to the running Docent API.
 * Usage:  npm run seed-demo
 * Point at a deployed instance with DOCENT_API_URL (defaults to localhost:3001).
 */
const BASE_URL = process.env.DOCENT_API_URL ?? 'http://localhost:3001';

async function main(): Promise<void> {
  const dir = 'sample-data';
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    console.error('No PDFs found in sample-data/. Run `npm run generate-sample-pdf` first.');
    process.exit(1);
  }

  let ok = 0;
  for (const file of files) {
    const buffer = await readFile(join(dir, file));
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), file);

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/documents`, { method: 'POST', body: form });
    } catch (err) {
      console.error(`Could not reach API at ${BASE_URL}:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }

    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
      status?: string;
    };
    if (!res.ok) {
      console.error(`Failed ${file}: ${body.error ?? res.status}`);
      continue;
    }
    console.log(`Queued ${file} -> id ${body.id} (status ${body.status})`);
    ok += 1;
  }

  console.log(`\nDone: ${ok}/${files.length} documents queued on ${BASE_URL}.`);
  console.log('Ingestion runs in the background; watch progress in the web UI or poll GET /documents.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});