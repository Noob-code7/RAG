export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type SourceType = 'pdf' | 'text';

export interface DocumentRow {
  id: string;
  notebook_id: string;
  filename: string;
  source_type: SourceType;
  uploaded_at: string;
  status: DocumentStatus;
  page_count: number | null;
  progress: number;
  error: string | null;
  storage_path?: string | null;
  content?: string | null;
}

export interface NotebookRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface Chunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
  tokenCount: number;
}

export type Confidence = 'grounded' | 'partial' | 'not_found';

export interface RetrievalHit {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  tokenCount: number;
  similarity: number;
}

export interface Citation {
  source_label: string;
  document_id: string;
  page_number: number;
  chunk_content_snippet: string;
}

export interface RetrievalInfo {
  source_label: string;
  page_number: number;
  similarity: number;
  snippet: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  confidence: Confidence;
  retrieval: RetrievalInfo[];
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageRow {
  id: string;
  notebook_id: string;
  role: ChatRole;
  content: string;
  citations: Citation[] | null;
  confidence: Confidence | null;
  created_at: string;
}

export type ArtifactType = 'saved_note' | 'flashcard_set' | 'quiz' | 'mind_map' | 'report' | 'data_table';

export interface MindMapNode {
  label: string;
  source_chunk_id?: string | null;
  citations: Citation[];
  children: MindMapNode[];
}

export interface MindMapTree {
  topic: string;
  children: MindMapNode[];
}

export interface FlashcardItem {
  question: string;
  answer: string;
  source_chunk_ids: string[];
  citations: Citation[];
}

export interface QuizItem {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source_chunk_ids: string[];
  citations: Citation[];
}

export interface DataTablePayload {
  columns: string[];
  rows: Array<Record<string, string>>;
  source_chunk_ids_by_row: string[][];
  citations_by_row: Citation[][];
}

export interface ArtifactRow {
  id: string;
  notebook_id: string;
  type: ArtifactType;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload?: unknown | null;
  created_at: string;
}