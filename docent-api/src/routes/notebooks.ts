import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/supabaseClient.js';
import { config } from '../config.js';
import { deleteDocumentFiles } from '../db/storage.js';
import { createDocumentRecord, ingestDocument } from '../services/ingestion/pipeline.js';
import {
  DEFAULT_NOTEBOOK_ID,
  getNotebook,
  listNotebooks,
  notebookExists,
} from '../services/notebookService.js';
import { listDocumentsByNotebook } from '../services/documentService.js';
import type { NotebookRow } from '../types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes },
});

const MAX_NAME_LENGTH = 120;

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

async function requireNotebook(id: string): Promise<boolean> {
  return notebookExists(id);
}

// --- Notebook CRUD ---------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const name = parseName((req.body ?? {}).name);
    if (!name) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }
    const { rows } = await query<NotebookRow>(
      `insert into notebooks (name) values ($1) returning id, name, created_at, updated_at`,
      [name],
    );
    const created = await getNotebook(rows[0].id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create notebook' });
  }
});

router.get('/', async (_req, res) => {
  try {
    res.json(await listNotebooks());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list notebooks' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const notebook = await getNotebook(req.params.id);
    if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
    res.json(notebook);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read notebook' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const name = parseName((req.body ?? {}).name);
    if (!name) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }
    if (!(await requireNotebook(req.params.id))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    await query(`update notebooks set name = $2 where id = $1`, [req.params.id, name]);
    const updated = await getNotebook(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to rename notebook' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === DEFAULT_NOTEBOOK_ID) {
      return res.status(409).json({ error: 'The default notebook cannot be deleted.' });
    }
    if (!(await requireNotebook(req.params.id))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    // Collect object-storage paths before the FK cascade removes the rows.
    const { rows } = await query<{ storage_path: string | null }>(
      `select storage_path from documents where notebook_id = $1`,
      [req.params.id],
    );
    await query(`delete from notebooks where id = $1`, [req.params.id]);
    // Best-effort cleanup of uploaded PDF files (document/chunk rows already
    // removed by the ON DELETE CASCADE).
    const paths = rows
      .map((r) => r.storage_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      deleteDocumentFiles(paths).catch((err) => {
        console.error(`Storage cleanup failed after notebook delete: ${err.message}`);
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete notebook' });
  }
});

// --- Notebook-scoped documents ---------------------------------------------

// Accepts either a multipart PDF upload ("file" field) or a JSON text source:
//   POST /notebooks/:id/documents        (multipart, field "file")
//   POST /notebooks/:id/documents        (JSON { title, content })
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  try {
    const notebookId = req.params.id;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const file = req.file;
    if (file) {
      if (!file.mimetype.includes('pdf') && !file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Only PDF files are supported.' });
      }
      const docId = await createDocumentRecord(notebookId, file.originalname, 'pdf');
      ingestDocument(docId, { type: 'pdf', buffer: file.buffer }).catch((err) => {
        console.error(`Unhandled ingestion error for ${docId}:`, err);
      });
      return res
        .status(202)
        .json({ id: docId, notebookId, filename: file.originalname, sourceType: 'pdf', status: 'processing' });
    }

    // Plain pasted-text source — stored as a document with one synthetic page.
    const body = (req.body ?? {}) as { title?: unknown; content?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!title || title.length > MAX_NAME_LENGTH) {
      return res
        .status(400)
        .json({ error: `For text sources, "title" is required (max ${MAX_NAME_LENGTH} chars).` });
    }
    if (!content) {
      return res.status(400).json({ error: 'For text sources, a non-empty "content" is required.' });
    }
    const docId = await createDocumentRecord(notebookId, title, 'text', content);
    ingestDocument(docId, { type: 'text', content }).catch((err) => {
      console.error(`Unhandled ingestion error for ${docId}:`, err);
    });
    return res
      .status(202)
      .json({ id: docId, notebookId, filename: title, sourceType: 'text', status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to queue document' });
  }
});

router.get('/:id/documents', async (req, res) => {
  try {
    if (!(await requireNotebook(req.params.id))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    res.json(await listDocumentsByNotebook(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list documents' });
  }
});

export default router;