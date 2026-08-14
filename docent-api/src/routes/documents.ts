import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/supabaseClient.js';
import { config } from '../config.js';
import { downloadDocumentFile } from '../db/storage.js';
import { createDocumentRecord, ingestDocument } from '../services/ingestion/pipeline.js';
import { DEFAULT_NOTEBOOK_ID } from '../services/notebookService.js';
import {
  LIST_SELECT,
  listDocumentsByNotebook,
  toDocumentJson,
} from '../services/documentService.js';
import type { DocumentRow } from '../types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes },
});

// Legacy endpoints are kept for backwards compatibility and now operate on the
// well-known "Default" notebook. New code should use the notebook-scoped API
// under /notebooks/:id/documents.
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Missing file. Expected a multipart field named "file".' });
    }
    if (!file.mimetype.includes('pdf') && !file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const id = await createDocumentRecord(DEFAULT_NOTEBOOK_ID, file.originalname, 'pdf');
    // Ingest in the background; the document's status field tracks progress.
    ingestDocument(id, { type: 'pdf', buffer: file.buffer }).catch((err) => {
      console.error(`Unhandled ingestion error for ${id}:`, err);
    });

    res.status(202).json({ id, notebookId: DEFAULT_NOTEBOOK_ID, filename: file.originalname, sourceType: 'pdf', status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start ingestion' });
  }
});

router.get('/', async (_req, res) => {
  try {
    res.json(await listDocumentsByNotebook(DEFAULT_NOTEBOOK_ID));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list documents' });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const { rows } = await query<DocumentRow>(
      `select ${LIST_SELECT} from documents where id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(toDocumentJson(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read document status' });
  }
});

// Returns the original source for a document so the frontend can open "View
// Source" links and download documents. PDFs stream from object storage;
// pasted-text sources are returned inline as text/plain.
router.get('/:id/file', async (req, res) => {
  try {
    const { rows } = await query<DocumentRow>(
      `select id, filename, source_type, storage_path, content from documents where id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const row = rows[0];

    if (row.source_type === 'text') {
      if (!row.content) {
        return res.status(409).json({ error: 'The text source is not available yet.' });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(row.filename)}.txt"`,
      );
      return res.send(row.content);
    }

    if (!row.storage_path) {
      return res.status(409).json({ error: 'The source file is not available yet.' });
    }
    const buffer = await downloadDocumentFile(row.storage_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(row.filename)}"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load document file' });
  }
});

export default router;