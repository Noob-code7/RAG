export type ScopeFilter = 'all' | 'verified' | 'processing';

export type Section = 'documents' | 'artifacts';

const FILTERS: { key: ScopeFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All Documents', icon: 'folder' },
  { key: 'verified', label: 'Ready', icon: 'verified' },
  { key: 'processing', label: 'Processing', icon: 'sync' },
];

export default function SideNav({
  notebookName,
  count,
  filter,
  onFilter,
  onUpload,
  section,
  onOpenArtifacts,
}: {
  notebookName?: string;
  count: number;
  filter: ScopeFilter;
  onFilter: (filter: ScopeFilter) => void;
  onUpload: () => void;
  section: Section;
  onOpenArtifacts: () => void;
}) {
  return (
    <aside className="hidden w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-lowest py-md text-secondary lg:flex">
      <div className="mb-md border-b border-outline-variant px-md pb-md">
        <div className="mb-xs flex items-center gap-sm">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-high">
            <span className="material-symbols-outlined text-[16px] text-secondary">account_tree</span>
          </div>
          <h2 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface" title={notebookName}>
            {notebookName ?? 'Workspace'}
          </h2>
        </div>
        <p className="font-label-caps text-label-caps text-on-surface-variant opacity-70">
          {count} Document{count === 1 ? '' : 's'} in this notebook
        </p>
      </div>

      <nav className="scroll-hidden flex flex-1 flex-col gap-xs overflow-y-auto px-sm font-label-caps text-label-caps">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              onClick={() => onFilter(f.key)}
              className={`flex items-center gap-sm rounded py-sm pl-sm pr-sm text-left transition-all ${
                active
                  ? 'border-l-4 border-secondary bg-surface-container font-bold text-secondary'
                  : 'border-l-4 border-transparent text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:opacity-100'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          );
        })}

        <div className="my-sm border-t border-outline-variant" />

        <button
          onClick={onOpenArtifacts}
          className={`flex items-center gap-sm rounded py-sm pl-sm pr-sm text-left transition-all ${
            section === 'artifacts'
              ? 'border-l-4 border-secondary bg-surface-container font-bold text-secondary'
              : 'border-l-4 border-transparent text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:opacity-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">collections_bookmark</span>
          <span>Artifacts</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-sm border-t border-outline-variant px-md pt-md">
        <button
          onClick={onUpload}
          className="flex w-full cursor-pointer items-center justify-center gap-sm rounded bg-primary py-sm font-body-ui text-body-ui text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Upload PDF
        </button>
        <div className="flex flex-col gap-xs font-label-caps text-label-caps">
          <a
            href="/help"
            className="flex items-center gap-sm px-sm py-xs text-on-surface-variant opacity-70 transition-opacity hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[16px]">help</span>
            Help
          </a>
        </div>
      </div>
    </aside>
  );
}