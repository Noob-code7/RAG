const DOCS = [
  { name: 'Q3_Earnings_Report_Draft_v2.pdf', status: 'Analyzing', color: '#F59E0B' },
  { name: 'Competitor_Analysis_2024.pdf', status: 'Ready', color: '#10B981' },
  { name: 'sample-rag-notes.pdf', status: 'Ready', color: '#10B981' },
];

export default function WorkspacePreview() {
  return (
    <div
      data-hero-visual
      className="glass-panel relative mx-auto mt-24 max-w-5xl overflow-hidden rounded-xl border border-outline-variant p-sm shadow-xl"
    >
      <div className="grid grid-cols-[200px_1fr] overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm sm:grid-cols-[240px_1fr]">
        <aside className="bg-primary-container p-md text-white">
          <div className="mb-lg flex items-center gap-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container text-[13px] font-bold text-white">
              D
            </span>
            <span className="font-headline-sm text-headline-sm font-semibold">Docent</span>
          </div>
          <div className="space-y-3">
            {DOCS.map((doc) => (
              <div key={doc.name} className="flex items-center gap-sm rounded-md bg-white/5 p-sm">
                <span className="material-symbols-outlined text-[16px] text-white/70">description</span>
                <span className="flex-1 truncate text-xs text-white/90">{doc.name}</span>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: doc.color }} />
              </div>
            ))}
          </div>
          <div className="mt-lg hidden border-t border-white/10 pt-md text-xs text-white/50 sm:block">
            + 4 more documents
          </div>
        </aside>

        <div className="flex min-h-[300px] flex-col bg-surface-container-lowest">
          <div className="flex items-center gap-sm border-b border-outline-variant/60 px-md py-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">menu</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">chat</span>
            <span className="ml-auto hidden truncate text-xs text-on-surface-variant sm:block">
              Q3_Earnings_Report_Draft_v2.pdf
            </span>
          </div>

          <div className="flex-1 space-y-sm p-md">
            <div className="rounded-lg bg-surface-container px-md py-sm text-sm font-medium text-on-surface">
              How did Q3 revenue change compared to last year?
            </div>
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-md font-body-doc text-body-doc text-on-surface">
              <p>
                Revenue grew{' '}
                <span className="rounded bg-secondary/10 px-1 font-semibold text-secondary">14%</span>{' '}
                year-over-year, driven by strength in the enterprise segment and higher average contract
                value.
              </p>
              <div className="mt-md flex flex-wrap gap-sm">
                <span className="cursor-pointer rounded bg-secondary/10 px-2 py-1 font-citation text-citation text-secondary transition-colors hover:bg-secondary/20">
                  Doc 4, p.12
                </span>
                <span className="cursor-pointer rounded bg-secondary/10 px-2 py-1 font-citation text-citation text-secondary transition-colors hover:bg-secondary/20">
                  Doc 1, p.3
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-sm border-t border-outline-variant/60 px-md py-sm text-xs text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Grounded · 2 sources cited
          </div>
        </div>
      </div>
    </div>
  );
}