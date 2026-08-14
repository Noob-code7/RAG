import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/supabaseClient.js';
import { config } from '../config.js';
import { createDocumentRecord, uploadAndIngest } from '../services/ingestion/pipeline.js';
import type { DocumentRow } from '../types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes },
});

interface DocumentJson {
  id: string;
  filename: string;
  uploadedAt: string;
  status: DocumentRow['status'];
  pageCount: number | null;
  progress: number;
  error: string | null;
}

function toJson(row: DocumentRow): DocumentJson {
  return {
    id: row.id,
    filename: row.filename,
    uploadedAt: row.uploaded_at,
    status: row.status,
    pageCount: row.page_count,
    progress: row.progress,
    error: row.error,
  };
}

const LIST_SELECT = `id, filename, uploaded_at, status, page_count, progress, error`;

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Missing file. Expected a multipart field named "file".' });
    }
    if (!file.mimetype.includes('pdf') && !file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const id = await createDocumentRecord(file.originalname);
    // Ingest in the background; the document's status field tracks progress.
    uploadAndIngest(id, file.buffer).catch((err) => {
      console.error(`Unhandled ingestion error for ${id}:`, err);
    });

    res.status(202).json({ id, filename: file.originalname, status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start ingestion' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query<DocumentRow>(`select ${LIST_SELECT} from documents order by uploaded_at desc`);
    res.json(rows.map(toJson));
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
    res.json(toJson(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read document status' });
  }
});

export default router;