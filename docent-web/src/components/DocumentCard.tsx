import type { DocumentSummary } from '../types';

function phaseLabel(progress: number): string {
  if (progress <= 0) return 'Extracting text…';
  if (progress < 0.5) return 'Extracting & chunking…';
  return 'Embedding chunks…';
}

export default function DocumentCard({
  doc,
  onRecheck,
}: {
  doc: DocumentSummary;
  onRecheck: (id: string) => void;
}) {
  if (doc.status === 'failed') {
    const isScanned = /scanned|no extractable text|ocr/i.test(doc.error ?? '');
    return (
      <div className="animate-rise relative rounded border border-error/30 bg-error-container p-sm">
        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l bg-error" />
        <div className="flex items-start gap-sm pl-xs">
          <span className="material-symbols-outlined text-error">
            {isScanned ? 'document_scanner' : 'error'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-label-caps text-label-caps text-on-error-container" title={doc.filename}>
              {doc.filename}
            </p>
            <p className="mt-xs font-citation text-citation text-error">
              {isScanned
                ? 'This PDF appears to be a scanned image — no extractable text. Try a text-based PDF or run OCR first.'
                : doc.error
                  ? `Failed: ${doc.error}`
                  : 'Failed'}
            </p>
          </div>
          <button
            onClick={() => onRecheck(doc.id)}
            aria-label="Retry"
            className="rounded p-1 text-error transition-colors hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      </div>
    );
  }

  if (doc.status === 'processing') {
    const pct = Math.round(doc.progress * 100);
    return (
      <div className="animate-rise relative rounded border border-outline-variant bg-surface-bright p-sm transition-colors hover:border-secondary">
        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l bg-amber-500" />
        <div className="flex items-start gap-sm pl-xs">
          <span className="material-symbols-outlined text-on-surface-variant">picture_as_pdf</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-label-caps text-label-caps text-on-surface" title={doc.filename}>
              {doc.filename}
            </p>
            <div className="mt-xs flex items-center justify-between">
              <span className="font-citation text-citation text-on-surface-variant">{phaseLabel(doc.progress)}</span>
              <span className="font-citation text-citation text-on-surface-variant">{pct}%</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise relative rounded border border-outline-variant bg-surface-bright p-sm transition-colors hover:border-secondary">
      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l bg-green-500" />
      <div className="flex items-start gap-sm pl-xs">
        <span className="material-symbols-outlined text-on-surface-variant">description</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-label-caps text-label-caps text-on-surface" title={doc.filename}>
            {doc.filename}
          </p>
          <div className="mt-xs flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span>
            <span className="font-citation text-citation text-green-700">Indexed &amp; Ready</span>
            {doc.pageCount != null && (
              <span className="font-citation text-citation text-on-surface-variant">· {doc.pageCount} pages</span>
            )}
          </div>
        </div>
        {doc.pageCount != null && (
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50 text-[10px] font-bold text-green-700"
            title="Page count"
          >
            {doc.pageCount}
          </div>
        )}
      </div>
    </div>
  );
}