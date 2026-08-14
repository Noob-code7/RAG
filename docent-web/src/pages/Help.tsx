import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppNavbar from '../components/app/AppNavbar';

const FAQS = [
  {
    q: 'How do I upload documents?',
    a: 'Open the Workspace, then drop a PDF into the upload area (or click “Browse Files”). Docent accepts text-based PDFs up to 25 MB. The document is processed in the background and appears in your context scope once it’s ready.',
  },
  {
    q: 'How do the citations work?',
    a: 'Every answer is grounded in your documents. When the model draws on a source, it emits a [1], [2] marker. Hover any marker to see the exact document, page, and quoted passage, or click “View Source” to open the original PDF.',
  },
  {
    q: 'Why did my document fail to index?',
    a: 'The most common cause is a scanned image PDF with no text layer. Docent needs machine-readable text to index. Re-export the file with OCR, or upload a text-based PDF. Failed documents show a Retry button in the workspace.',
  },
  {
    q: 'What is the confidence indicator?',
    a: 'Each answer shows a confidence badge. “High” means the retrieved evidence was a strong match, “Medium” a partial one, and “Low” that Docent found only weak overlap — it will refuse to guess rather than fabricate.',
  },
  {
    q: 'Can I organize documents in the library?',
    a: 'Yes. The Library supports search, filters by status, and an archive. Select multiple documents to archive or delete them in bulk, and use the archive view to keep your main workspace tidy.',
  },
  {
    q: 'Is Docent free?',
    a: 'This is a development demo. The plan card in Settings shows the current (dummy) plan; real pricing and plans are not implemented yet.',
  },
];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'G then /', action: 'Go to workspace' },
  { keys: 'G then L', action: 'Go to library' },
  { keys: 'G then S', action: 'Open settings' },
  { keys: 'G then H', action: 'Open help' },
  { keys: 'Esc', action: 'Close menus and dialogs' },
  { keys: 'Enter', action: 'Send a message (Shift+Enter for a new line)' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-md px-md py-sm text-left font-body-ui text-body-ui font-semibold text-on-surface"
      >
        {q}
        <span className={`material-symbols-outlined shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <p className="border-t border-outline-variant px-md py-sm font-body-doc text-body-doc text-on-surface-variant">
          {a}
        </p>
      )}
    </div>
  );
}

export default function Help() {
  const [query, setQuery] = useState('');

  const visible = query.trim()
    ? FAQS.filter((f) => f.q.toLowerCase().includes(query.trim().toLowerCase()))
    : FAQS;

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-md pb-16 pt-24 md:px-lg">
        <header className="mb-lg">
          <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">Help &amp; support</h1>
          <p className="font-body-doc text-body-doc text-on-surface-variant">
            Answers to common questions, keyboard shortcuts, and ways to reach us.
          </p>
        </header>

        <div className="relative mb-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-sm font-body-ui text-body-ui text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none"
          />
        </div>

        <section className="mb-xl">
          <h2 className="mb-sm font-headline-sm text-headline-sm text-on-surface">Frequently asked questions</h2>
          <div className="flex flex-col gap-sm">
            {visible.length === 0 ? (
              <p className="font-body-ui text-body-ui text-on-surface-variant">
                No articles match “{query}”. Try a different search, or contact support below.
              </p>
            ) : (
              visible.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)
            )}
          </div>
        </section>

        <section id="shortcuts" className="mb-xl">
          <h2 className="mb-sm font-headline-sm text-headline-sm text-on-surface">Keyboard shortcuts</h2>
          <ul className="flex flex-col gap-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
            {SHORTCUTS.map((s) => (
              <li key={s.action} className="flex items-center justify-between gap-md py-xs">
                <span className="font-body-ui text-body-ui text-on-surface-variant">{s.action}</span>
                <span className="rounded border border-outline-variant bg-surface-container px-sm py-xs font-citation text-citation text-on-surface">
                  {s.keys}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-xl">
          <h2 className="mb-sm font-headline-sm text-headline-sm text-on-surface">Still stuck?</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <a
              href="mailto:support@docent.app"
              className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
            >
              <span className="material-symbols-outlined text-secondary">mail</span>
              <div>
                <p className="font-body-ui text-body-ui font-semibold text-on-surface">Email support</p>
                <p className="font-body-ui text-[12px] text-on-surface-variant">support@docent.app</p>
              </div>
            </a>
            <Link
              to="/how-it-works"
              className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
            >
              <span className="material-symbols-outlined text-secondary">menu_book</span>
              <div>
                <p className="font-body-ui text-body-ui font-semibold text-on-surface">How Docent works</p>
                <p className="font-body-ui text-[12px] text-on-surface-variant">Read the technical overview</p>
              </div>
            </Link>
            <a
              href="#"
              className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
            >
              <span className="material-symbols-outlined text-secondary">forum</span>
              <div>
                <p className="font-body-ui text-body-ui font-semibold text-on-surface">Community forum</p>
                <p className="font-body-ui text-[12px] text-on-surface-variant">Discuss with other users</p>
              </div>
            </a>
            <Link
              to="/notebooks"
              className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
            >
              <span className="material-symbols-outlined text-secondary">chat_bubble</span>
              <div>
                <p className="font-body-ui text-body-ui font-semibold text-on-surface">Go to notebooks</p>
                <p className="font-body-ui text-[12px] text-on-surface-variant">Pick a notebook and start asking questions</p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}