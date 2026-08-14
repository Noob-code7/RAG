import type { Citation } from '../types';

export default function CitationPopover({ citation, filename }: { citation: Citation; filename: string }) {
  const n = citation.source_label.match(/\[Source\s+(\d+)\]/)?.[1] ?? citation.source_label;
  return (
    <span className="group relative inline-block align-super">
      <button className="citation-marker cursor-pointer rounded border border-secondary/20 px-1 align-super font-citation text-citation hover:border-secondary/50">
        [{n}]
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[300px] -translate-x-1/2 rounded border border-outline-variant bg-surface-container-lowest p-sm opacity-0 shadow-lg transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="mb-1 flex items-center justify-between gap-sm border-b border-outline-variant pb-1 font-label-caps text-label-caps text-on-surface-variant">
          <span className="truncate" title={filename}>
            {filename}
          </span>
          <span className="shrink-0">Pg. {citation.page_number}</span>
        </div>
        <p className="font-body-ui text-[12px] leading-5 text-on-surface">
          &ldquo;{citation.chunk_content_snippet.slice(0, 240)}
          {citation.chunk_content_snippet.length > 240 ? '…' : ''}&rdquo;
        </p>
        <div className="mt-2 text-right">
          <button className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-secondary hover:underline">
            View Source
          </button>
        </div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-surface-container-lowest" />
      </div>
    </span>
  );
}