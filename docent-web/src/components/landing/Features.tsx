const INGESTION_ROWS = [
  { name: 'Q3_Earnings_Report_Draft_v2.pdf', status: 'Analyzing', accent: '#F59E0B', icon: 'description' },
  { name: 'Competitor_Analysis_2024.pdf', status: 'Ready', accent: '#10B981', icon: 'description' },
];

export default function Features() {
  return (
    <section id="features" className="bg-surface-container-lowest py-32">
      <div className="mx-auto max-w-7xl px-md sm:px-lg lg:px-xl">
        <div className="mb-24 text-center">
          <h2 data-reveal className="font-headline-md text-headline-md text-on-surface">
            Engineered for Precision
          </h2>
        </div>

        <div data-reveal-group className="grid grid-cols-1 gap-md md:grid-cols-3">
          {/* Verifiable Citations */}
          <div
            data-reveal-item
            className="glass-panel group flex flex-col justify-between rounded-xl border border-outline-variant p-lg transition-colors duration-300 hover:border-secondary md:col-span-2"
          >
            <div className="mb-lg">
              <span className="material-symbols-outlined mb-sm text-3xl text-secondary">format_quote</span>
              <h3 className="font-headline-sm text-headline-sm mb-sm text-on-surface">Verifiable Citations</h3>
              <p className="font-body-ui text-on-surface-variant">
                Integrated source snippets verify every claim. Click any citation marker to jump instantly to
                the exact highlight in your source document.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-sm rounded-lg border border-outline-variant/50 bg-surface-container-low p-md">
              <span className="font-body-ui text-on-surface">
                According to the Q3 report, revenue grew by{' '}
                <span className="rounded bg-secondary/10 px-1 font-semibold text-secondary">14%</span>
              </span>
              <span className="cursor-pointer rounded bg-secondary/10 px-2 py-1 font-citation text-citation text-secondary transition-colors hover:bg-secondary/20">
                Doc 4, p.12
              </span>
            </div>
          </div>

          {/* Multi-Doc Context */}
          <div
            data-reveal-item
            className="glass-panel group rounded-xl border border-outline-variant p-lg transition-colors duration-300 hover:border-secondary"
          >
            <span className="material-symbols-outlined mb-sm text-3xl text-secondary">account_tree</span>
            <h3 className="font-headline-sm text-headline-sm mb-sm text-on-surface">Multi-Doc Context</h3>
            <p className="font-body-ui text-on-surface-variant">
              Query across entire libraries seamlessly. Synthesize findings from dozens of papers without
              losing context.
            </p>
          </div>

          {/* Zero Hallucination */}
          <div
            data-reveal-item
            className="glass-panel group rounded-xl border border-outline-variant p-lg transition-colors duration-300 hover:border-secondary"
          >
            <span className="material-symbols-outlined mb-sm text-3xl text-secondary">policy</span>
            <h3 className="font-headline-sm text-headline-sm mb-sm text-on-surface">Zero Hallucination</h3>
            <p className="font-body-ui text-on-surface-variant">
              Visible confidence signals ensure accuracy. If the answer isn&apos;t in your data, Docent
              explicitly states it.
            </p>
          </div>

          {/* Instant Ingestion */}
          <div
            data-reveal-item
            className="glass-panel group flex flex-col justify-between rounded-xl border border-outline-variant p-lg transition-colors duration-300 hover:border-secondary md:col-span-2"
          >
            <div className="mb-lg">
              <span className="material-symbols-outlined mb-sm text-3xl text-secondary">speed</span>
              <h3 className="font-headline-sm text-headline-sm mb-sm text-on-surface">Instant Ingestion</h3>
              <p className="font-body-ui text-on-surface-variant">
                Automated PDF parsing &amp; indexing. Upload gigabytes of complex research, contracts, or
                reports and begin querying in seconds.
              </p>
            </div>
            <div className="flex flex-col gap-xs">
              {INGESTION_ROWS.map((row) => (
                <div key={row.name}>
                  <div className="flex items-center gap-sm">
                    <div className="h-8 w-1 rounded-l" style={{ background: row.accent }} />
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">{row.icon}</span>
                    <span className="flex-grow truncate font-label-caps text-label-caps text-on-surface">
                      {row.name}
                    </span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant">{row.status}</span>
                  </div>
                  <div className="h-px w-full bg-outline-variant/30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}