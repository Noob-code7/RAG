import { Router } from 'express';
import { runQuery } from '../services/queryService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      question?: unknown;
      document_ids?: unknown;
      notebook_id?: unknown;
    };
    if (typeof body.question !== 'string' || body.question.trim().length === 0) {
      return res.status(400).json({ error: 'question is required and must be a non-empty string' });
    }
    if (
      !Array.isArray(body.document_ids) ||
      body.document_ids.length === 0 ||
      body.document_ids.some((x) => typeof x !== 'string')
    ) {
      return res.status(400).json({ error: 'document_ids must be a non-empty array of strings' });
    }
    if (body.notebook_id !== undefined && typeof body.notebook_id !== 'string') {
      return res.status(400).json({ error: 'notebook_id must be a string' });
    }
    const question = body.question.trim();
    const documentIds = body.document_ids as string[];
    const notebookId = body.notebook_id as string | undefined;

    res.json(await runQuery({ question, documentIds, notebookId }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Query failed' });
  }
});

export default router;