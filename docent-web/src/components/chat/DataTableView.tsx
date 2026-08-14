import { useState } from 'react';
import type { Artifact, Citation, DataTablePayload, DocumentSummary } from '../../types';
import CitationPopover from '../CitationPopover';
import { downloadDataTable } from '../../api/client';

export default function DataTableView({
  notebookId,
  artifact,
  docs,
  onExit,
}: {
  notebookId: string;
  artifact: Artifact;
  docs: DocumentSummary[];
  onExit: () => void;
}) {
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payload = artifact.payload as DataTablePayload | null;
  const columns = payload?.columns ?? [];
  const rows = payload?.rows ?? [];
  const citationsByRow = payload?.citations_by_row ?? [];

  const onExport = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    setError(null);
    try {
      await downloadDataTable(notebookId, artifact.id, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const filenameFor = (documentId: string) =>
    docs.find((d) => d.id === documentId)?.filename ?? 'Source document';

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div className="min-w-0">
          <h3 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {artifact.title}
          </h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Data table · {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} column
            {columns.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <button
            onClick={() => void onExport('csv')}
            disabled={busy !== null}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">
              {busy === 'csv' ? 'progress_activity animate-spin' : 'download'}
            </span>
            Export CSV
          </button>
          <button
            onClick={() => void onExport('xlsx')}
            disabled={busy !== null}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded bg-primary px-sm py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">
              {busy === 'xlsx' ? 'progress_activity animate-spin' : 'grid_on'}
            </span>
            Export XLSX
          </button>
          <button
            onClick={onExit}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </button>
        </div>
      </header>

      <div className="scroll-hidden flex-1 overflow-auto p-xl">
        <div className="mx-auto w-full max-w-[960px]">
          {error && <p className="mb-md font-body-ui text-body-ui text-error">{error}</p>}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-md py-24 text-center">
              <span className="material-symbols-outlined text-[44px] text-outline-variant">table_rows</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">No rows extracted</h4>
              <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
                The source material does not contain the structured facts this table asked for — the
                generator correctly declined to invent rows.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full border-collapse font-body-ui text-body-ui text-on-surface">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap border-r border-outline-variant px-sm py-sm text-left font-label-caps text-label-caps text-on-surface"
                      >
                        {col}
                      </th>
                    ))}
                    <th className="px-sm py-sm text-left font-label-caps text-label-caps text-on-surface-variant">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const cite: Citation | undefined = citationsByRow[i]?.[0];
                    return (
                      <tr key={i} className="border-b border-outline-variant/60 last:border-b-0">
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="whitespace-pre-wrap border-r border-outline-variant/60 px-sm py-sm align-top"
                          >
                            {row[col] ?? ''}
                          </td>
                        ))}
                        <td className="px-sm py-sm align-top">
                          {cite ? (
                            <CitationPopover
                              citation={cite}
                              filename={filenameFor(cite.document_id)}
                            />
                          ) : (
                            <span className="font-label-caps text-label-caps text-outline-variant">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(payload?.citations_by_row?.length ?? 0) > 0 && (
            <p className="mt-md font-label-caps text-label-caps text-on-surface-variant">
              Hover a row&rsquo;s source marker to see the chunk that supports that row.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}