import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toNotebookJson } from '../src/services/notebookService.js';
import { toDocumentJson } from '../src/services/documentService.js';
import type { DocumentRow } from '../src/types.js';

test('toNotebookJson maps a notebook row to the API shape', () => {
  const json = toNotebookJson({
    id: 'n1',
    name: 'Research',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    document_count: 4,
  });
  assert.deepEqual(json, {
    id: 'n1',
    name: 'Research',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    documentCount: 4,
  });
});

test('toNotebookJson reports zero documents when nothing is joined', () => {
  const json = toNotebookJson({
    id: 'n2',
    name: 'Empty',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    document_count: 0,
  });
  assert.equal(json.documentCount, 0);
});

test('toDocumentJson maps a document row and keeps notebook + source type', () => {
  const row: DocumentRow = {
    id: 'd1',
    notebook_id: 'n1',
    filename: 'notes.pdf',
    source_type: 'pdf',
    uploaded_at: '2026-01-01T00:00:00Z',
    status: 'ready',
    page_count: 3,
    progress: 1,
    error: null,
  };
  const json = toDocumentJson(row);
  assert.equal(json.id, 'd1');
  assert.equal(json.notebookId, 'n1');
  assert.equal(json.sourceType, 'pdf');
  assert.equal(json.filename, 'notes.pdf');
  assert.equal(json.pageCount, 3);
  assert.equal(json.status, 'ready');
});

test('toDocumentJson surfaces text sources', () => {
  const row: DocumentRow = {
    id: 'd2',
    notebook_id: 'n2',
    filename: 'Pasted notes',
    source_type: 'text',
    uploaded_at: '2026-01-01T00:00:00Z',
    status: 'processing',
    page_count: 1,
    progress: 0,
    error: null,
  };
  const json = toDocumentJson(row);
  assert.equal(json.sourceType, 'text');
  assert.equal(json.pageCount, 1);
  assert.equal(json.status, 'processing');
});