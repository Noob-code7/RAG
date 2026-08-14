export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type SourceType = 'pdf' | 'text';

export interface DocumentSummary {
  id: string;
  notebookId?: string;
  filename: string;
  sourceType?: SourceType;
  uploadedAt: string;
  status: DocumentStatus;
  pageCount: number | null;
  progress: number;
  error: string | null;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export type Confidence = 'grounded' | 'partial' | 'not_found';

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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: Confidence;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatHistoryMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations: Citation[] | null;
  confidence: Confidence | null;
  createdAt: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ArtifactType = 'saved_note' | 'flashcard_set' | 'quiz' | 'mind_map' | 'report' | 'data_table';

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

export interface MindMapNode {
  label: string;
  source_chunk_id: string | null;
  citations: Citation[];
  children: MindMapNode[];
}

export interface MindMapTree {
  topic: string;
  children: MindMapNode[];
}

export interface DataTablePayload {
  columns: string[];
  rows: Array<Record<string, string>>;
  source_chunk_ids_by_row: string[][];
  citations_by_row: Citation[][];
}

export interface Artifact {
  id: string;
  notebookId: string;
  type: ArtifactType;
  title: string;
  content: string;
  citations: Citation[] | null;
  payload: FlashcardItem[] | QuizItem[] | MindMapTree | DataTablePayload | null;
  createdAt: string;
}