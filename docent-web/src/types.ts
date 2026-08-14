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