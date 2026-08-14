import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',

  // --- Embeddings provider ---
  // Defaults to Google Gemini (AI Studio): gemini-embedding-001 via the native
  // batchEmbedContents endpoint, 1536 dimensions (flexible dims, matches the
  // vector(1536) schema). OpenAI is supported by setting
  // EMBEDDING_PROVIDER=openai, EMBEDDING_BASE_URL=https://api.openai.com/v1,
  // EMBEDDING_MODEL=text-embedding-3-small, EMBEDDING_DIMENSIONS=1536.
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'gemini',
  embeddingApiKey:
    process.env.EMBEDDING_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '',
  embeddingBaseUrl:
    process.env.EMBEDDING_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-004',
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  chunkTokens: Number(process.env.CHUNK_TOKENS ?? 500),
  overlapTokens: Number(process.env.OVERLAP_TOKENS ?? 50),
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB ?? 25) * 1024 * 1024,
  storageBucket: process.env.STORAGE_BUCKET ?? 'documents',
  // Below this average characters-per-page we treat the PDF as a scanned image
  // with no extractable text layer and fail the ingestion instead of indexing
  // nothing silently.
  minCharsPerPage: Number(process.env.MIN_CHARS_PER_PAGE ?? 20),

  // --- Retrieval / generation (Phase 2) ---
  retrievalTopK: Number(process.env.RETRIEVAL_TOP_K ?? 8),
  rerankTopN: Number(process.env.RERANK_TOP_N ?? 4),
  // Confidence bands on cosine similarity (1 - pgvector cosine distance).
  // Threshold rationale (rough guides — tune per embedding model):
  //   - >= HIGH: the top chunk is a strong lexical/semantic match for the
  //     question -> answer can be grounded.
  //   - LOW..HIGH: weak topical overlap; answer is at best partial.
  //   - < LOW: effectively unrelated -> refuse without calling the model,
  //     which is the hard guardrail against fabricated answers.
  embeddingSimHigh: Number(process.env.EMBED_SIM_THRESHOLD_HIGH ?? 0.4),
  embeddingSimLow: Number(process.env.EMBED_SIM_THRESHOLD_LOW ?? 0.25),

  // --- Study artifacts (Phase 4) ---
  // Chunks pulled into a flashcard/quiz generation prompt (broader than the
  // single-query top-N). Upper bound on items a generation may produce.
  artifactContextChunks: Number(process.env.ARTIFACT_CONTEXT_CHUNKS ?? 24),
  maxArtifactCount: Number(process.env.MAX_ARTIFACT_COUNT ?? 20),
  // Mind-map structure caps — enforced in code after parsing, never trusted to
  // the model. Depth counts levels below the root topic; children caps the
  // fan-out of any single node.
  mindMapMaxDepth: Number(process.env.MIND_MAP_MAX_DEPTH ?? 3),
  mindMapMaxChildren: Number(process.env.MIND_MAP_MAX_CHILDREN ?? 8),
  // Data-table structure caps — enforced in code after parsing, never trusted
  // to the model. A table is a structured extraction, so we treat a table
  // suspiciously larger than ~2 rows per source chunk as hallucinated structure
  // and truncate it (the "flag suspiciously large tables" sanity check).
  dataTableMaxColumns: Number(process.env.DATA_TABLE_MAX_COLUMNS ?? 20),
  dataTableRowRatio: Number(process.env.DATA_TABLE_ROW_RATIO ?? 3),
  dataTableMaxRows: Number(process.env.DATA_TABLE_MAX_ROWS ?? 30),
  generationProvider: process.env.GENERATION_PROVIDER ?? 'gemini',
  generationModel: process.env.GENERATION_MODEL ?? 'gemini-3.6-flash',
  generationBaseUrl:
    process.env.GENERATION_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  generationApiKey:
    process.env.GENERATION_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '',

  // --- Observability / cost visibility (Phase 6) ---
  // List prices per 1M tokens (dev estimates; override per provider/plan).
  // Defaults reflect OpenAI list pricing for the models Docent uses by default.
  embeddingPricePerMToken: Number(process.env.EMBEDDING_PRICE_PER_MT ?? 0.02),
  generationInputPricePerMToken: Number(process.env.GENERATION_INPUT_PRICE_PER_MT ?? 0.15),
  generationOutputPricePerMToken: Number(process.env.GENERATION_OUTPUT_PRICE_PER_MT ?? 0.6),
};