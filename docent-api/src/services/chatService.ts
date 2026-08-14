import { query } from '../db/supabaseClient.js';
import type { ArtifactRow, ArtifactType, ChatMessageRow, Citation, Confidence } from '../types.js';

export interface ChatMessageJson {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  confidence: Confidence | null;
  createdAt: string;
}

export interface ArtifactJson {
  id: string;
  notebookId: string;
  type: ArtifactType;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: unknown | null;
  createdAt: string;
}

export class MessageNotFoundError extends Error {
  constructor() {
    super('Message not found in this notebook');
    this.name = 'MessageNotFoundError';
  }
}

export class OnlyAssistantCanBeSavedError extends Error {
  constructor() {
    super('Only assistant answers can be saved as notes');
    this.name = 'OnlyAssistantCanBeSavedError';
  }
}

const MESSAGE_SELECT =
  'id, notebook_id, role, content, citations, confidence, created_at';

function toMessageJson(row: ChatMessageRow): ChatMessageJson {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: row.citations,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export function toArtifactJson(row: ArtifactRow): ArtifactJson {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    type: row.type,
    title: row.title,
    content: row.content,
    citations: row.citations,
    payload: row.payload ?? null,
    createdAt: row.created_at,
  };
}

/** Persist one user question + the grounded assistant answer; returns the assistant message id. */
export async function saveChatExchange(
  notebookId: string,
  question: string,
  answer: string,
  citations: Citation[],
  confidence: Confidence,
): Promise<string> {
  await query(`insert into chat_messages (notebook_id, role, content) values ($1, 'user', $2)`, [
    notebookId,
    question,
  ]);
  const { rows } = await query<{ id: string }>(
    `insert into chat_messages (notebook_id, role, content, citations, confidence)
     values ($1, 'assistant', $2, $3::jsonb, $4) returning id`,
    [notebookId, answer, JSON.stringify(citations), confidence],
  );
  return rows[0].id;
}

export async function listMessages(notebookId: string): Promise<ChatMessageJson[]> {
  const { rows } = await query<ChatMessageRow>(
    `select ${MESSAGE_SELECT} from chat_messages where notebook_id = $1 order by created_at asc, id asc`,
    [notebookId],
  );
  return rows.map(toMessageJson);
}

async function getMessage(notebookId: string, messageId: string): Promise<ChatMessageRow | null> {
  const { rows } = await query<ChatMessageRow>(
    `select ${MESSAGE_SELECT} from chat_messages where id = $1 and notebook_id = $2`,
    [messageId, notebookId],
  );
  return rows[0] ?? null;
}

/** Copy an assistant answer (with its citations) into the artifacts table as a saved note. */
export async function saveMessageAsNote(
  notebookId: string,
  messageId: string,
  title?: string,
): Promise<ArtifactJson> {
  const message = await getMessage(notebookId, messageId);
  if (!message) throw new MessageNotFoundError();
  if (message.role !== 'assistant') throw new OnlyAssistantCanBeSavedError();
  const resolvedTitle =
    (title ?? '').trim() || message.content.replace(/\s+/g, ' ').slice(0, 60) || 'Saved note';
  const { rows } = await query<ArtifactRow>(
    `insert into artifacts (notebook_id, type, title, content, citations)
     values ($1, 'saved_note', $2, $3, $4::jsonb)
     returning id, notebook_id, type, title, content, citations, created_at`,
    [notebookId, resolvedTitle, message.content, JSON.stringify(message.citations ?? [])],
  );
  return toArtifactJson(rows[0]);
}

export async function listArtifacts(notebookId: string): Promise<ArtifactJson[]> {
  const { rows } = await query<ArtifactRow>(
    `select id, notebook_id, type, title, content, citations, payload, created_at
     from artifacts where notebook_id = $1 order by created_at desc`,
    [notebookId],
  );
  return rows.map(toArtifactJson);
}

export async function getArtifact(
  notebookId: string,
  artifactId: string,
): Promise<ArtifactJson | null> {
  const { rows } = await query<ArtifactRow>(
    `select id, notebook_id, type, title, content, citations, payload, created_at
     from artifacts where id = $1 and notebook_id = $2`,
    [artifactId, notebookId],
  );
  return rows[0] ? toArtifactJson(rows[0]) : null;
}