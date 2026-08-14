import type { DocumentSummary, QueryResponse } from '../types';

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

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/documents', { method: 'POST', body: form });
  return handle<DocumentSummary>(res);
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch('/documents');
  return handle<DocumentSummary[]>(res);
}

export async function getDocumentStatus(id: string): Promise<DocumentSummary> {
  const res = await fetch(`/documents/${id}/status`);
  return handle<DocumentSummary>(res);
}

export async function queryDocuments(question: string, documentIds: string[]): Promise<QueryResponse> {
  const res = await fetchWithTimeout('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_ids: documentIds }),
  });
  return handle<QueryResponse>(res);
}