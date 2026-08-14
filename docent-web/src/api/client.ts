import type { DocumentSummary, Notebook, QueryResponse } from '../types';

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