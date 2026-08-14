import { query } from '../db/supabaseClient.js';
import type { NotebookRow } from '../types.js';

/** Well-known notebook used by the legacy /documents endpoints. */
export const DEFAULT_NOTEBOOK_ID = '00000000-0000-0000-0000-000000000000';

export interface NotebookWithCount extends NotebookRow {
  document_count: number;
}

export interface NotebookJson {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

const NOTEBOOK_SELECT = `
  select n.id, n.name, n.created_at, n.updated_at,
         count(d.id)::int as document_count
  from notebooks n
  left join documents d on d.notebook_id = n.id
`;

export function toNotebookJson(row: NotebookWithCount): NotebookJson {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: row.document_count,
  };
}

export async function notebookExists(id: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>(`select id from notebooks where id = $1`, [id]);
  return rows.length > 0;
}

export async function getNotebook(id: string): Promise<NotebookJson | null> {
  const { rows } = await query<NotebookWithCount>(
    `${NOTEBOOK_SELECT} where n.id = $1 group by n.id`,
    [id],
  );
  return rows.length > 0 ? toNotebookJson(rows[0]) : null;
}

export async function listNotebooks(): Promise<NotebookJson[]> {
  const { rows } = await query<NotebookWithCount>(
    `${NOTEBOOK_SELECT} group by n.id order by n.created_at asc`,
  );
  return rows.map(toNotebookJson);
}