import { query } from '../db/supabaseClient.js';
import type { DocumentRow } from '../types.js';

export interface DocumentJson {
  id: string;
  notebookId: string;
  filename: string;
  sourceType: DocumentRow['source_type'];
  uploadedAt: string;
  status: DocumentRow['status'];
  pageCount: number | null;
  progress: number;
  error: string | null;
}

export const LIST_SELECT = `id, notebook_id, filename, source_type, uploaded_at, status, page_count, progress, error`;

export function toDocumentJson(row: DocumentRow): DocumentJson {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    filename: row.filename,
    sourceType: row.source_type,
    uploadedAt: row.uploaded_at,
    status: row.status,
    pageCount: row.page_count,
    progress: row.progress,
    error: row.error,
  };
}

export async function listDocumentsByNotebook(notebookId: string): Promise<DocumentJson[]> {
  const { rows } = await query<DocumentRow>(
    `select ${LIST_SELECT} from documents where notebook_id = $1 order by uploaded_at desc`,
    [notebookId],
  );
  return rows.map(toDocumentJson);
}