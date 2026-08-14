import { Router, type Response } from 'express';
import { notebookExists } from '../services/notebookService.js';
import { runQuery } from '../services/queryService.js';
import {
  generateDataTable,
  generateFlashcards,
  generateMindMap,
  generateQuiz,
  generateReport,
  MalformedOutputError,
  NoReadyDocumentsError,
} from '../services/artifactService.js';
import {
  getArtifact,
  listArtifacts,
  listMessages,
  MessageNotFoundError,
  OnlyAssistantCanBeSavedError,
  saveChatExchange,
  saveMessageAsNote,
} from '../services/chatService.js';
import { renderReportPdf, slugify } from '../services/reportExportService.js';
import { renderDataTableCsv, renderDataTableXlsx } from '../services/dataTableExportService.js';
import type { DataTablePayload } from '../types.js';

const router = Router();

async function requireNotebook(id: string): Promise<boolean> {
  return notebookExists(id);
}

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

interface ArtifactInput {
  documentIds: string[];
  topic?: string;
  difficulty?: Difficulty;
  count: number;
  columnsHint?: string;
}

function parseArtifactInput(body: unknown): { input: ArtifactInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (
    !Array.isArray(b.document_ids) ||
    b.document_ids.length === 0 ||
    b.document_ids.some((x) => typeof x !== 'string')
  ) {
    return { error: 'document_ids must be a non-empty array of strings' };
  }
  let topic: string | undefined;
  const rawTopic = b.topic !== undefined ? b.topic : b.focus;
  if (rawTopic !== undefined) {
    if (typeof rawTopic !== 'string') return { error: 'topic must be a string' };
    const trimmed = rawTopic.trim();
    if (trimmed.length > 200) return { error: 'topic must be at most 200 characters' };
    topic = trimmed.length > 0 ? trimmed : undefined;
  }
  let difficulty: Difficulty | undefined;
  if (b.difficulty !== undefined) {
    if (typeof b.difficulty !== 'string' || !DIFFICULTIES.includes(b.difficulty as Difficulty)) {
      return { error: 'difficulty must be one of: easy, medium, hard' };
    }
    difficulty = b.difficulty as Difficulty;
  }
  let count = 6;
  if (b.count !== undefined) {
    if (typeof b.count !== 'number' || !Number.isInteger(b.count)) {
      return { error: 'count must be an integer' };
    }
    if (b.count < 1 || b.count > 20) {
      return { error: 'count must be between 1 and 20' };
    }
    count = b.count;
  }
  let columnsHint: string | undefined;
  if (b.columns_hint !== undefined) {
    if (typeof b.columns_hint !== 'string') return { error: 'columns_hint must be a string' };
    const trimmed = b.columns_hint.trim();
    if (trimmed.length > 300) return { error: 'columns_hint must be at most 300 characters' };
    columnsHint = trimmed.length > 0 ? trimmed : undefined;
  }
  return {
    input: { documentIds: b.document_ids as string[], topic, difficulty, count, columnsHint },
  };
}

async function runArtifactGeneration(
  res: Response,
  notebookId: string,
  body: unknown,
  kind: 'flashcards' | 'quiz' | 'mind-map' | 'report' | 'data-table',
): Promise<void> {
  if (!(await requireNotebook(notebookId))) {
    res.status(404).json({ error: 'Notebook not found' });
    return;
  }
  const parsed = parseArtifactInput(body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const artifact =
      kind === 'flashcards'
        ? await generateFlashcards({ notebookId, ...parsed.input })
        : kind === 'quiz'
          ? await generateQuiz({ notebookId, ...parsed.input })
          : kind === 'mind-map'
            ? await generateMindMap({ notebookId, ...parsed.input })
            : kind === 'report'
              ? await generateReport({
                  notebookId,
                  ...parsed.input,
                  // Reports synthesize across a broad spread of the source material.
                  count: Math.max(parsed.input.count, 16),
                })
              : await generateDataTable({
                  notebookId,
                  ...parsed.input,
                  // Tables extract across a spread of chunks, not a single hit.
                  count: Math.max(parsed.input.count, 8),
                });
    res.status(201).json(artifact);
  } catch (err) {
    if (err instanceof NoReadyDocumentsError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof MalformedOutputError) {
      res.status(422).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate artifact' });
  }
}

// --- Notebook-scoped grounded chat -----------------------------------------

// Grounded query + persist the exchange into this notebook's chat history.
router.post('/:id/query', async (req, res) => {
  try {
    const notebookId = req.params.id;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    const body = (req.body ?? {}) as { question?: unknown; document_ids?: unknown };
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
    const question = body.question.trim();
    const documentIds = body.document_ids as string[];

    const result = await runQuery({ question, documentIds, notebookId });
    const messageId = await saveChatExchange(
      notebookId,
      question,
      result.answer,
      result.citations,
      result.confidence,
    );
    res.json({ ...result, message_id: messageId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Query failed' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const notebookId = req.params.id;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    res.json(await listMessages(notebookId));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load chat history' });
  }
});

// Turn an assistant answer into a saved note artifact.
router.post('/:id/messages/:messageId/save-as-note', async (req, res) => {
  try {
    const { id: notebookId, messageId } = req.params;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    const body = (req.body ?? {}) as { title?: unknown };
    const title = typeof body.title === 'string' ? body.title : undefined;
    const artifact = await saveMessageAsNote(notebookId, messageId, title);
    res.status(201).json(artifact);
  } catch (err) {
    if (err instanceof MessageNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof OnlyAssistantCanBeSavedError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save note' });
  }
});

router.get('/:id/artifacts', async (req, res) => {
  try {
    const notebookId = req.params.id;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    res.json(await listArtifacts(notebookId));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list artifacts' });
  }
});

// --- Study artifacts: flashcards + quizzes ---------------------------------

router.post('/:id/artifacts/flashcards', (req, res) => {
  void runArtifactGeneration(res, req.params.id, req.body, 'flashcards');
});

router.post('/:id/artifacts/quiz', (req, res) => {
  void runArtifactGeneration(res, req.params.id, req.body, 'quiz');
});

router.post('/:id/artifacts/mind-map', (req, res) => {
  void runArtifactGeneration(res, req.params.id, req.body, 'mind-map');
});

router.post('/:id/artifacts/report', (req, res) => {
  void runArtifactGeneration(res, req.params.id, req.body, 'report');
});

router.post('/:id/artifacts/data-table', (req, res) => {
  void runArtifactGeneration(res, req.params.id, req.body, 'data-table');
});

// Download an artifact:
//  - report    -> Markdown (.md) or styled PDF (rendered via headless Chromium)
//  - data_table -> CSV or real .xlsx (exceljs)
router.get('/:id/artifacts/:artifactId/export', async (req, res) => {
  try {
    const { id: notebookId, artifactId } = req.params;
    if (!(await requireNotebook(notebookId))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    const artifact = await getArtifact(notebookId, artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const base = `${slugify(artifact.title)}-${artifact.id.slice(0, 8)}`;
    const format = req.query.format;

    if (artifact.type === 'report') {
      const kind = format === undefined || format === 'pdf' ? 'pdf' : format === 'md' ? 'md' : null;
      if (!kind) {
        return res.status(400).json({ error: "format must be 'pdf' or 'md'" });
      }
      if (kind === 'md') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${base}.md"`);
        return res.send(artifact.content ?? '');
      }
      const pdf = await renderReportPdf(artifact.content ?? '', artifact.title);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdf.length));
      res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
      return res.send(pdf);
    }

    if (artifact.type === 'data_table') {
      const kind = format === undefined || format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : null;
      if (!kind) {
        return res.status(400).json({ error: "format must be 'xlsx' or 'csv'" });
      }
      const payload = (artifact.payload ?? null) as DataTablePayload | null;
      if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows)) {
        return res.status(400).json({ error: 'Data table artifact is missing its payload' });
      }
      if (kind === 'csv') {
        const csv = renderDataTableCsv(payload);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
        return res.send(csv);
      }
      const xlsx = await renderDataTableXlsx(payload);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Length', String(xlsx.length));
      res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
      return res.send(xlsx);
    }

    return res.status(400).json({ error: 'This artifact type cannot be exported' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export artifact' });
  }
});

export default router;