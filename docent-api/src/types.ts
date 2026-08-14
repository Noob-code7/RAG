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