import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }
  return client;
}

let bucketPromise: Promise<void> | null = null;

export function ensureBucket(): Promise<void> {
  if (!bucketPromise) {
    bucketPromise = (async () => {
      const sb = getSupabase();
      const { data, error } = await sb.storage.getBucket(config.storageBucket);
      if (error && !data) {
        const { error: createError } = await sb.storage.createBucket(config.storageBucket, {
          public: false,
        });
        if (createError) throw new Error(`Could not create storage bucket: ${createError.message}`);
      }
    })();
  }
  return bucketPromise;
}

export async function uploadDocumentFile(docId: string, buffer: Buffer): Promise<string> {
  await ensureBucket();
  const storagePath = `documents/${docId}.pdf`;
  const { error } = await getSupabase()
    .storage.from(config.storageBucket)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

export async function downloadDocumentFile(storagePath: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(config.storageBucket).download(storagePath);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}