import { useCallback, useEffect, useState } from 'react';
import { listDocuments } from '../api/client';
import type { DocumentSummary } from '../types';
import AppNavbar from '../components/app/AppNavbar';
import UploadView from '../components/app/UploadView';

export default function Upload() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const docs = await listDocuments();
    setDocuments(docs);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  const hasProcessing = documents.some((d) => d.status === 'processing');

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => refresh().catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [hasProcessing, refresh]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <UploadView documents={documents} onRefresh={refresh} />
      {error && (
        <p className="mx-auto w-full max-w-[960px] px-md pb-4 font-body-ui text-body-ui text-error">{error}</p>
      )}
    </div>
  );
}