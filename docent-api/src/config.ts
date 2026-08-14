import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
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
  // Threshold rationale (tuned for OpenAI text-embedding-3-small):
  //   - >= HIGH: the top chunk is a strong lexical/semantic match for the
  //     question -> answer can be grounded.
  //   - LOW..HIGH: weak topical overlap; answer is at best partial.
  //   - < LOW: effectively unrelated -> refuse without calling the model,
  //     which is the hard guardrail against fabricated answers.
  embeddingSimHigh: Number(process.env.EMBED_SIM_THRESHOLD_HIGH ?? 0.4),
  embeddingSimLow: Number(process.env.EMBED_SIM_THRESHOLD_LOW ?? 0.25),
  generationProvider: process.env.GENERATION_PROVIDER ?? 'openai',
  generationModel: process.env.GENERATION_MODEL ?? 'gpt-4o-mini',
  generationBaseUrl: process.env.GENERATION_BASE_URL || undefined,
  generationApiKey: process.env.GENERATION_API_KEY ?? process.env.OPENAI_API_KEY ?? '',

  // --- Observability / cost visibility (Phase 6) ---
  // List prices per 1M tokens (dev estimates; override per provider/plan).
  // Defaults reflect OpenAI list pricing for the models Docent uses by default.
  embeddingPricePerMToken: Number(process.env.EMBEDDING_PRICE_PER_MT ?? 0.02),
  generationInputPricePerMToken: Number(process.env.GENERATION_INPUT_PRICE_PER_MT ?? 0.15),
  generationOutputPricePerMToken: Number(process.env.GENERATION_OUTPUT_PRICE_PER_MT ?? 0.6),
};