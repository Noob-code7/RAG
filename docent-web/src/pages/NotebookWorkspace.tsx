import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getNotebook, listNotebookDocuments } from '../api/client';
import type { DocumentSummary, Notebook } from '../types';
import AppNavbar from '../components/app/AppNavbar';
import UploadView from '../components/app/UploadView';
import SideNav, { type ScopeFilter } from '../components/chat/SideNav';
import ContextScope from '../components/chat/ContextScope';
import ChatPanel from '../components/chat/ChatPanel';

function WorkspaceBreadcrumb({ notebook }: { notebook: Notebook | null }) {
  return (
    <div className="flex shrink-0 items-center gap-md border-b border-outline-variant bg-surface-container-lowest px-lg py-sm">
      <Link
        to="/"
        className="flex items-center gap-xs font-label-caps text-label-caps text-secondary transition-colors hover:text-primary"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        All Notebooks
      </Link>
      <span className="text-outline-variant">/</span>
      <span className="truncate font-label-caps text-label-caps text-on-surface">
        {notebook?.name ?? 'Workspace'}
      </span>
    </div>
  );
}

export default function NotebookWorkspace() {
  const { id = '' } = useParams<{ id: string }>();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [view, setView] = useState<'upload' | 'chat'>('upload');
  const [filter, setFilter] = useState<ScopeFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const autoSelected = useRef(false);
  const manualUpload = useRef(false);

  const refresh = useCallback(async () => {
    const docs = await listNotebookDocuments(id);
    setDocuments(docs);
  }, [id]);

  useEffect(() => {
    setNotebook(null);
    setNotFound(false);
    setDocuments([]);
    setView('upload');
    setFilter('all');
    setError(null);
    autoSelected.current = false;
    manualUpload.current = false;

    getNotebook(id)
      .then(setNotebook)
      .catch((err) => {
        const message = err instanceof Error ? err.message : '';
        if (message.toLowerCase().includes('not found')) {
          setNotFound(true);
        } else {
          setError(message || 'Failed to load notebook');
        }
      });

    refresh().catch((err) => setError(err.message));
  }, [id, refresh]);

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

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
        <AppNavbar />
        <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center justify-center gap-sm px-md text-center">
          <span className="material-symbols-outlined text-[44px] text-outline-variant">folder_off</span>
          <h1 className="font-headline-md text-headline-md text-on-surface">Notebook not found</h1>
          <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
            This notebook may have been deleted or the link is incorrect.
          </p>
          <Link
            to="/"
            className="mt-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
          >
            ← All Notebooks
          </Link>
        </main>
      </div>
    );
  }

  if (view === 'upload') {
    return (
      <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
        <AppNavbar />
        <div className="pt-16">
          <WorkspaceBreadcrumb notebook={notebook} />
        </div>
        <UploadView
          notebookId={id}
          notebookName={notebook?.name}
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
      <div className="flex flex-1 flex-col overflow-hidden pt-16">
        <WorkspaceBreadcrumb notebook={notebook} />
        <div className="flex flex-1 overflow-hidden">
          <SideNav
            notebookName={notebook?.name}
            count={documents.length}
            filter={filter}
            onFilter={setFilter}
            onUpload={openUpload}
          />
          <main className="flex h-full flex-1 bg-surface">
            <ContextScope
              documents={filtered}
              selectedIds={selectedIds}
              onToggle={toggle}
              onSelectAll={selectAll}
            />
            <ChatPanel
              notebookId={id}
              selectedDocs={selectedDocs}
              allDocs={documents}
              onClearContext={() => setSelectedIds([])}
              loadError={error}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
