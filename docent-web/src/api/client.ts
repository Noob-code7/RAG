import type {
  Artifact,
  ChatHistoryMessage,
  Difficulty,
  DocumentSummary,
  Notebook,
  QueryResponse,
} from '../types';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 90_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('The query timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Every document belongs to exactly one notebook. There is intentionally no
// global/unscoped documents endpoint in the UI — documents are only ever
// listed through /notebooks/:id/documents.

export async function listNotebooks(): Promise<Notebook[]> {
  const res = await fetch('/notebooks');
  return handle<Notebook[]>(res);
}

export async function getNotebook(id: string): Promise<Notebook> {
  const res = await fetch(`/notebooks/${id}`);
  return handle<Notebook>(res);
}

export async function createNotebook(name: string): Promise<Notebook> {
  const res = await fetch('/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return handle<Notebook>(res);
}

export async function renameNotebook(id: string, name: string): Promise<Notebook> {
  const res = await fetch(`/notebooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return handle<Notebook>(res);
}

export async function deleteNotebook(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/notebooks/${id}`, { method: 'DELETE' });
  return handle<{ ok: boolean }>(res);
}

export async function listNotebookDocuments(notebookId: string): Promise<DocumentSummary[]> {
  const res = await fetch(`/notebooks/${notebookId}/documents`);
  return handle<DocumentSummary[]>(res);
}

export async function uploadToNotebook(notebookId: string, file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/notebooks/${notebookId}/documents`, { method: 'POST', body: form });
  return handle<DocumentSummary>(res);
}

export async function addTextToNotebook(
  notebookId: string,
  title: string,
  content: string,
): Promise<DocumentSummary> {
  const res = await fetch(`/notebooks/${notebookId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  return handle<DocumentSummary>(res);
}

/** URL of the original uploaded PDF for a document (proxy → docent-api). */
export function documentFileUrl(id: string): string {
  return `/documents/${id}/file`;
}

export async function getDocumentStatus(id: string): Promise<DocumentSummary> {
  const res = await fetch(`/documents/${id}/status`);
  return handle<DocumentSummary>(res);
}

export async function queryDocuments(
  question: string,
  documentIds: string[],
  notebookId?: string,
): Promise<QueryResponse> {
  const res = await fetchWithTimeout('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      document_ids: documentIds,
      ...(notebookId ? { notebook_id: notebookId } : {}),
    }),
  });
  return handle<QueryResponse>(res);
}

/** Grounded, notebook-scoped chat query. Also persists the exchange to history. */
export async function queryNotebook(
  notebookId: string,
  question: string,
  documentIds: string[],
): Promise<QueryResponse & { message_id: string }> {
  const res = await fetchWithTimeout(`/notebooks/${notebookId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_ids: documentIds }),
  });
  return handle<QueryResponse & { message_id: string }>(res);
}

export async function getNotebookMessages(notebookId: string): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`/notebooks/${notebookId}/messages`);
  return handle<ChatHistoryMessage[]>(res);
}

export async function saveMessageAsNote(
  notebookId: string,
  messageId: string,
  title?: string,
): Promise<Artifact> {
  const res = await fetch(`/notebooks/${notebookId}/messages/${messageId}/save-as-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(title ? { body: JSON.stringify({ title }) } : {}),
  });
  return handle<Artifact>(res);
}

export async function getNotebookArtifacts(notebookId: string): Promise<Artifact[]> {
  const res = await fetch(`/notebooks/${notebookId}/artifacts`);
  return handle<Artifact[]>(res);
}

export interface ArtifactGenerationOptions {
  documentIds: string[];
  topic?: string;
  difficulty?: Difficulty;
  count?: number;
  /** Optional user hint for what structured facts to extract (data tables). */
  columnsHint?: string;
}

async function postArtifact(
  notebookId: string,
  kind: 'flashcards' | 'quiz' | 'mind-map' | 'report' | 'data-table',
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  const res = await fetchWithTimeout(`/notebooks/${notebookId}/artifacts/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_ids: options.documentIds,
      ...(options.topic ? { topic: options.topic } : {}),
      ...(options.difficulty ? { difficulty: options.difficulty } : {}),
      ...(options.count ? { count: options.count } : {}),
      ...(options.columnsHint ? { columns_hint: options.columnsHint } : {}),
    }),
  });
  return handle<Artifact>(res);
}

export async function generateFlashcards(
  notebookId: string,
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  return postArtifact(notebookId, 'flashcards', options);
}

export async function generateQuiz(
  notebookId: string,
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  return postArtifact(notebookId, 'quiz', options);
}

export async function generateMindMap(
  notebookId: string,
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  return postArtifact(notebookId, 'mind-map', options);
}

export async function generateReport(
  notebookId: string,
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  return postArtifact(notebookId, 'report', options);
}

export async function generateDataTable(
  notebookId: string,
  options: ArtifactGenerationOptions,
): Promise<Artifact> {
  return postArtifact(notebookId, 'data-table', options);
}

/** Download an exported artifact, triggering a browser download. */
async function downloadExport(notebookId: string, artifactId: string, format: string): Promise<void> {
  const res = await fetch(`/notebooks/${notebookId}/artifacts/${artifactId}/export?format=${format}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `docent-export.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a report artifact as Markdown or a styled PDF. */
export async function downloadReport(
  notebookId: string,
  artifactId: string,
  format: 'pdf' | 'md',
): Promise<void> {
  return downloadExport(notebookId, artifactId, format);
}

/** Download a data table as CSV or a real .xlsx workbook. */
export async function downloadDataTable(
  notebookId: string,
  artifactId: string,
  format: 'xlsx' | 'csv',
): Promise<void> {
  return downloadExport(notebookId, artifactId, format);
}