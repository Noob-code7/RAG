import type { DocumentSummary } from '../../types';

interface Props {
  documents: DocumentSummary[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

function DocRow({
  doc,
  checked,
  onToggle,
}: {
  doc: DocumentSummary;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const selectable = doc.status === 'ready';

  return (
    <div
      onClick={selectable ? () => onToggle(doc.id) : undefined}
      className={`flex items-start gap-sm rounded border border-outline-variant p-sm transition-colors ${
        selectable ? 'cursor-pointer border-l-4 hover:border-secondary' : 'border-l-4'
      } ${checked ? 'border-l-secondary bg-surface-container-low shadow-sm' : 'border-l-transparent'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!selectable}
        onChange={() => onToggle(doc.id)}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-sm border-outline-variant text-secondary accent-secondary disabled:cursor-not-allowed"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-xs">
          <span
            className={`material-symbols-outlined text-[16px] ${selectable ? 'text-secondary' : 'text-outline'}`}
          >
            picture_as_pdf
          </span>
          <h4 className="truncate font-body-ui text-body-ui font-semibold text-on-surface" title={doc.filename}>
            {doc.filename}
          </h4>
        </div>
        <div className="mt-xs flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
          <span>{doc.pageCount != null ? `${doc.pageCount} pages` : '— pages'}</span>
          {doc.status === 'processing' ? (
            <span className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[12px]">sync</span>
              Indexing
            </span>
          ) : doc.status === 'ready' ? (
            <span className={`flex items-center gap-1 ${checked ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
              <span className={`h-2 w-2 rounded-full ${checked ? 'bg-on-tertiary-container' : 'bg-outline'}`} />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-error">
              <span className="material-symbols-outlined text-[12px]">error</span>
              Failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContextScope({ documents, selectedIds, onToggle, onSelectAll }: Props) {
  const readyIds = documents.filter((d) => d.status === 'ready').map((d) => d.id);
  const allSelected = readyIds.length > 0 && readyIds.every((id) => selectedIds.includes(id));

  return (
    <section className="hidden w-[320px] shrink-0 flex-col border-r border-outline-variant bg-surface md:flex">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest p-md">
        <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Context Scope</h3>
        <button
          onClick={onSelectAll}
          className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-secondary transition-colors hover:text-primary"
        >
          {allSelected ? 'Clear' : 'Select All'}
        </button>
      </div>

      <div className="scroll-hidden flex flex-1 flex-col gap-sm overflow-y-auto bg-surface p-md">
        {documents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-sm px-md text-center">
            <span className="material-symbols-outlined text-[36px] text-outline-variant">folder_open</span>
            <p className="font-body-ui text-body-ui text-on-surface-variant">
              No documents here yet. Upload a PDF to start querying.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} checked={selectedIds.includes(doc.id)} onToggle={onToggle} />
          ))
        )}
      </div>
    </section>
  );
}