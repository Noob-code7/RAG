export type ScopeFilter = 'all' | 'recent' | 'verified' | 'processing';

const FILTERS: { key: ScopeFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All Documents', icon: 'folder' },
  { key: 'recent', label: 'Recent', icon: 'history' },
  { key: 'verified', label: 'Verified', icon: 'verified' },
  { key: 'processing', label: 'Processing', icon: 'sync' },
];

export default function SideNav({
  count,
  filter,
  onFilter,
  onUpload,
}: {
  count: number;
  filter: ScopeFilter;
  onFilter: (filter: ScopeFilter) => void;
  onUpload: () => void;
}) {
  return (
    <aside className="hidden w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-lowest py-md text-secondary lg:flex">
      <div className="mb-md border-b border-outline-variant px-md pb-md">
        <div className="mb-xs flex items-center gap-sm">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-high">
            <span className="material-symbols-outlined text-[16px] text-secondary">account_tree</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Research Workspace
          </h2>
        </div>
        <p className="font-label-caps text-label-caps text-on-surface-variant opacity-70">
          {count} Documents Active
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
            href="#"
            className="flex items-center gap-sm px-sm py-xs text-on-surface-variant opacity-70 transition-opacity hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[16px]">help</span>
            Help
          </a>
          <a
            href="#"
            className="flex items-center gap-sm px-sm py-xs text-on-surface-variant opacity-70 transition-opacity hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[16px]">archive</span>
            Archive
          </a>
        </div>
      </div>
    </aside>
  );
}