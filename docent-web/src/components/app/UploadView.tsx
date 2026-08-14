import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getDocumentStatus, uploadToNotebook } from '../../api/client';
import type { DocumentSummary } from '../../types';
import { useDismissable } from '../../hooks/useDismissable';
import DocumentCard from '../DocumentCard';

gsap.registerPlugin(useGSAP);

const MAX_PREVIEW = 5;

type IngestFilter = 'all' | 'ready' | 'processing' | 'failed';

const FILTERS: { key: IngestFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'processing', label: 'Processing' },
  { key: 'failed', label: 'Failed' },
];

interface Props {
  notebookId: string;
  notebookName?: string;
  documents: DocumentSummary[];
  onRefresh: () => Promise<void>;
  showBackToWorkspace?: boolean;
  onBackToWorkspace?: () => void;
}

export default function UploadView({
  notebookId,
  notebookName,
  documents,
  onRefresh,
  showBackToWorkspace = false,
  onBackToWorkspace,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<IngestFilter>('all');
  const { open, setOpen, ref: filterRef } = useDismissable();

  // Stop the browser from navigating away when a file is dropped outside the zone.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        '[data-ws-header]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      );
      gsap.fromTo(
        '[data-ws-panel]',
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.15, ease: 'power3.out', stagger: 0.12 },
      );
      gsap.to('[data-float-icon]', {
        y: -6,
        duration: 2.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: rootRef },
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfs = Array.from(files).filter(
        (f) => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfs.length === 0) {
        setError('Only PDF files are supported.');
        return;
      }
      setUploading(true);
      setError(null);
      try {
        for (const file of pdfs) {
          await uploadToNotebook(notebookId, file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [notebookId, onRefresh],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    void uploadFiles(e.dataTransfer.files);
  };

  const handleRecheck = useCallback(
    async (id: string) => {
      try {
        await getDocumentStatus(id);
        await onRefresh();
      } catch {
        // status recheck is best-effort
      }
    },
    [onRefresh],
  );

  const visibleDocs = (showAll ? documents : documents.slice(0, MAX_PREVIEW)).filter((d) =>
    filter === 'all' ? true : d.status === filter,
  );

  const hasProcessing = documents.some((d) => d.status === 'processing');
  const hasReady = documents.some((d) => d.status === 'ready');

  const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? 'All';
  const filteredCount = documents.filter((d) =>
    filter === 'all' ? true : d.status === filter,
  ).length;

  return (
    <main ref={rootRef} className="mx-auto w-full max-w-[960px] flex-1 overflow-y-auto px-md pb-12 pt-lg md:px-lg">
      <div data-ws-header className="mb-lg flex items-start justify-between gap-md">
        <div>
          <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">Upload &amp; Ingestion</h1>
          <p className="max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
            Add documents to {notebookName ? `“${notebookName}”` : 'this notebook'}. Our system will automatically
            parse, index, and prepare them for analysis — sources stay isolated to this notebook.
          </p>
        </div>
        {showBackToWorkspace && onBackToWorkspace && (
          <button
            onClick={onBackToWorkspace}
            className="flex shrink-0 items-center gap-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
            Open Workspace
          </button>
        )}
      </div>

      {error && (
        <div className="mb-md flex items-center gap-sm rounded-lg border border-error/30 bg-error-container px-md py-sm text-sm text-on-error-container">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="rounded p-1 transition-colors hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {hasProcessing && !hasReady && (
        <div className="mb-md flex items-center gap-sm rounded-lg border border-secondary/30 bg-secondary/5 px-md py-sm font-body-ui text-body-ui text-on-surface">
          <span className="material-symbols-outlined animate-spin text-secondary">sync</span>
          <span className="flex-1">
            Your documents are still indexing. The workspace opens automatically as soon as at least one is
            ready.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        {/* Drop zone + guidelines */}
        <div data-ws-panel className="flex flex-col lg:col-span-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setIsDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) {
                dragDepth.current = 0;
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
            className={`group relative flex min-h-[320px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed p-xl transition-all duration-200 hover:border-secondary hover:bg-surface-container-low ${
              isDragging
                ? 'scale-[1.01] border-secondary bg-secondary/5'
                : 'border-outline-variant bg-surface-container-lowest'
            }`}
          >
            <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_center,rgba(0,81,213,0.10),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div
              data-float-icon
              className="mb-md flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-primary transition-colors duration-300 group-hover:scale-110 group-hover:text-secondary"
            >
              <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
            </div>
            <h3 className="mb-xs font-headline-md text-headline-md text-on-surface">Drag &amp; Drop PDFs</h3>
            <p className="mb-lg max-w-xs text-center font-body-ui text-body-ui text-on-surface-variant">
              Supported format: PDF, up to 25MB per file.
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="rounded border-none bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Browse Files'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
              }}
            />
          </div>

          <div className="mt-md flex items-start gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
            <span className="material-symbols-outlined text-on-surface-variant">info</span>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-[14px] text-on-surface">
                Best Practices for OCR
              </h4>
              <p className="mt-xs font-body-ui text-body-ui text-[12px] text-on-surface-variant">
                Ensure documents are high resolution. Scanned documents should be at least 300 DPI for
                reliable text extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Recent ingestions */}
        <div data-ws-panel className="flex max-h-[520px] flex-col rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center justify-between rounded-t-lg border-b border-outline-variant bg-surface-bright p-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Recent Ingestions</h2>
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-xs font-label-caps text-label-caps text-secondary transition-colors hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                {filterLabel}
                {filter !== 'all' && (
                  <span className="rounded-full bg-secondary/15 px-1.5 text-[10px] font-bold">
                    {filteredCount}
                  </span>
                )}
                <span
                  className={`material-symbols-outlined text-[14px] transition-transform ${open ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>
              {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 animate-fade-pop overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-xs shadow-lg">
                  {FILTERS.map((f) => {
                    const count = documents.filter((d) =>
                      f.key === 'all' ? true : d.status === f.key,
                    ).length;
                    return (
                      <button
                        key={f.key}
                        onClick={() => {
                          setFilter(f.key);
                          setOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-sm px-md py-sm text-left font-body-ui text-body-ui transition-colors ${
                          filter === f.key
                            ? 'bg-surface-container text-secondary'
                            : 'text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        {f.label}
                        <span className="font-label-caps text-label-caps text-on-surface-variant">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="custom-scrollbar flex flex-1 flex-col gap-xs overflow-y-auto p-sm">
            {visibleDocs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-sm px-md py-xl text-center">
                <span className="material-symbols-outlined text-[36px] text-outline-variant">folder_open</span>
                <p className="font-body-ui text-body-ui text-on-surface-variant">
                  No documents yet. Drop a PDF to start ingesting.
                </p>
              </div>
            ) : (
              visibleDocs.map((doc) => <DocumentCard key={doc.id} doc={doc} onRecheck={handleRecheck} />)
            )}
          </div>
          {documents.length > MAX_PREVIEW && (
            <div className="rounded-b-lg border-t border-outline-variant bg-surface-bright p-xs">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full py-1 font-citation text-citation text-secondary transition-colors hover:text-primary"
              >
                {showAll ? 'Show Less' : `View All (${documents.length})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}