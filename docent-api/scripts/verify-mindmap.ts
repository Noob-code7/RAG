import 'dotenv/config';

/**
 * Phase 5 Definition-of-Done verification — mind map from a real document.
 * Prints the generated tree next to the exact source text it was built from,
 * so the DoD spot-check (every leaf's citation shows source text that supports
 * that leaf's claim) can be done in one pass.
 *
 * Requires: docent-api running (npm run dev) with SUPABASE + embedding + model
 * env configured, and migrations 001-005 applied.
 * Usage:  npm run verify-mindmap
 * Point at a running docent-api with DOCENT_API_URL (defaults to localhost:3001).
 * The notebook is deleted on exit.
 */
const API_URL = (process.env.DOCENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
}
interface MindMapNode {
  label: string;
  source_chunk_id: string | null;
  citations: Citation[];
  children: MindMapNode[];
}
interface MindMapTree {
  topic: string;
  children: MindMapNode[];
}
interface ArtifactJson {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: MindMapTree | null;
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

function walk(node: MindMapNode, depth: number, lines: string[]): number {
  let leaves = 0;
  lines.push(`${'  '.repeat(depth)}- ${node.label}`);
  if (node.citations.length > 0) {
    lines.push(`${'  '.repeat(depth)}  [src p${node.citations[0].page_number}: "${node.citations[0].chunk_content_snippet.slice(0, 90)}${node.citations[0].chunk_content_snippet.length > 90 ? '…' : ''}"]`);
  }
  if (node.children.length === 0) leaves += 1;
  for (const child of node.children) leaves += walk(child, depth + 1, lines);
  return leaves;
}

function maxDepth(nodes: MindMapNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(...nodes.map((n) => maxDepth(n.children)));
}

async function main(): Promise<void> {
  const tag = Date.now();
  console.log(`API: ${API_URL}\n`);

  const notebook: Notebook = await api('/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Verify Mind Map ${tag}` }),
  });
  const doc = await api<{ id: string }>(`/notebooks/${notebook.id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Docent facts ${tag}`, content: SOURCE_TEXT }),
  });
  const status = await pollReady(doc.id);
  console.log(`Notebook: ${notebook.id}  doc: ${doc.id}  status: ${status}\n`);
  if (status !== 'ready') throw new Error(`Source did not become ready (${status})`);

  const map = await api<ArtifactJson>(`/notebooks/${notebook.id}/artifacts/mind-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: [doc.id], topic: 'Docent chunking and retrieval' }),
  });

  const tree = map.payload;
  if (!tree) throw new Error('Mind map has no payload');

  console.log('======== SOURCE (what the model was given) ========');
  console.log(SOURCE_TEXT);
  console.log('\n======== MIND MAP (verify each leaf against the source) ========');
  const lines: string[] = [`${tree.topic} (root)`];
  let leafCount = 0;
  for (const child of tree.children) leafCount += walk(child, 1, lines);
  console.log(lines.join('\n'));

  const depth = maxDepth(tree.children);
  report(depth >= 2, `Tree is genuinely hierarchical (depth ${depth} >= 2)`);
  report(leafCount >= 3, `Tree has ${leafCount} grounded leaves`);
  const uncitedLeaves = (() => {
    let n = 0;
    const collect = (nodes: MindMapNode[]) => {
      for (const node of nodes) {
        if (node.children.length === 0 && node.citations.length === 0) n += 1;
        collect(node.children);
      }
    };
    collect(tree.children);
    return n;
  })();
  report(uncitedLeaves === 0, `Every leaf carries a citation (${uncitedLeaves} uncited)`);

  console.log('\n========================================');
  console.log(
    `SUMMARY: mind map depth ${depth}, ${leafCount} leaves. Spot-check the leaf citations ` +
      `above — each [src pN: "..."] must match that leaf's claim in the SOURCE.`,
  );
  process.exit(depth >= 2 && leafCount >= 3 && uncitedLeaves === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});