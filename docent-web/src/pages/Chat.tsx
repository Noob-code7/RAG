import { useCallback, useEffect, useRef, useState } from 'react';
import { listDocuments } from '../api/client';
import type { DocumentSummary } from '../types';
import AppNavbar from '../components/app/AppNavbar';
import UploadView from '../components/app/UploadView';
import SideNav, { type ScopeFilter } from '../components/chat/SideNav';
import ContextScope from '../components/chat/ContextScope';
import ChatPanel from '../components/chat/ChatPanel';

export default function Chat() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [view, setView] = useState<'upload' | 'chat'>('upload');
  const [filter, setFilter] = useState<ScopeFilter>('recent');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const autoSelected = useRef(false);
  const manualUpload = useRef(false);

  const refresh = useCallback(async () => {
    const docs = await listDocuments();
    setDocuments(docs);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  const hasReady = documents.some((d) => d.status === 'ready');

  // The workspace boots on the upload view and auto-switches to the chat once
  // documents are indexed — unless the user opened upload manually to add more.
  useEffect(() => {
    if (view === 'upload' && hasReady && !manualUpload.current) {
      setView('chat');
    }
    if (!hasReady && view === 'chat') {
      setView('upload');
    }
  }, [view, hasReady]);

  // Default: select every ready document on first load.
  useEffect(() => {
    if (autoSelected.current) return;
    const ready = documents.filter((d) => d.status === 'ready').map((d) => d.id);
    if (ready.length > 0) {
      autoSelected.current = true;
      setSelectedIds(ready);
    }
  }, [documents]);

  const hasProcessing = documents.some((d) => d.status === 'processing');

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => refresh().catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [hasProcessing, refresh]);

  const openUpload = useCallback(() => {
    manualUpload.current = true;
    setView('upload');
  }, []);

  const backToWorkspace = useCallback(() => {
    manualUpload.current = false;
    setView('chat');
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((ids) => {
      const ready = documents.filter((d) => d.status === 'ready').map((d) => d.id);
      const all = ready.length > 0 && ready.every((id) => ids.includes(id));
      return all ? [] : ready;
    });
  }, [documents]);

  if (view === 'upload') {
    return (
      <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
        <AppNavbar />
        <UploadView
          documents={documents}
          onRefresh={refresh}
          showBackToWorkspace={hasReady}
          onBackToWorkspace={backToWorkspace}
        />
        {error && (
          <p className="mx-auto w-full max-w-[960px] px-md pb-4 font-body-ui text-body-ui text-error">{error}</p>
        )}
      </div>
    );
  }

  const filtered = documents.filter((d) => {
    if (filter === 'verified') return d.status === 'ready';
    if (filter === 'processing') return d.status === 'processing';
    return true;
  });

  const selectedDocs = documents.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface font-body-ui text-body-ui text-on-surface">
      <AppNavbar />
      <div className="flex flex-1 overflow-hidden pt-16">
        <SideNav count={documents.length} filter={filter} onFilter={setFilter} onUpload={openUpload} />
        <main className="flex h-full flex-1 bg-surface">
          <ContextScope
            documents={filtered}
            selectedIds={selectedIds}
            onToggle={toggle}
            onSelectAll={selectAll}
          />
          <ChatPanel
            selectedDocs={selectedDocs}
            allDocs={documents}
            onClearContext={() => setSelectedIds([])}
            loadError={error}
          />
        </main>
      </div>
    </div>
  );
}