import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createNotebook, listNotebooks } from '../api/client';
import type { Notebook } from '../types';
import AppNavbar from '../components/app/AppNavbar';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NotebooksHome() {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setNotebooks(await listNotebooks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notebooks');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const closeDialog = () => {
    setCreating(false);
    setName('');
    setCreateError(null);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const notebook = await createNotebook(trimmed);
      closeDialog();
      navigate(`/notebooks/${notebook.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create notebook');
      setSubmitting(false);
    }
  };

  const totalSources = notebooks.reduce((sum, n) => sum + n.documentCount, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-md pb-16 pt-24 md:px-lg">
        <header className="mb-lg flex flex-wrap items-start justify-between gap-md">
          <div>
            <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">Notebooks</h1>
            <p className="max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
              Each notebook is its own isolated workspace. Upload documents inside a notebook and ask questions
              grounded in that notebook&rsquo;s sources only.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex shrink-0 cursor-pointer items-center gap-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Notebook
          </button>
        </header>

        {error && (
          <div className="mb-md flex items-center gap-sm rounded-lg border border-error/30 bg-error-container px-md py-sm text-sm text-on-error-container">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span className="flex-1">{error}</span>
            <button
              onClick={() => void refresh()}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-error/40 bg-transparent px-sm py-1 font-label-caps text-label-caps text-error transition-colors hover:bg-error/10"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-md py-32 text-center">
            <span className="material-symbols-outlined text-[44px] text-outline-variant">folder_open</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Create your first notebook</h2>
            <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
              A notebook keeps your sources and conversations together and isolated from everything else.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-sm flex cursor-pointer items-center gap-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Notebook
            </button>
          </div>
        ) : (
          <>
            <p className="mb-md font-label-caps text-label-caps text-on-surface-variant">
              {notebooks.length} notebook{notebooks.length === 1 ? '' : 's'} · {totalSources} source
              {totalSources === 1 ? '' : 's'}
            </p>
            <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
              {notebooks.map((nb) => (
                <li key={nb.id}>
                  <Link
                    to={`/notebooks/${nb.id}`}
                    className="group flex h-full flex-col justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
                  >
                    <div>
                      <div className="mb-sm flex items-center gap-sm">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-container-high text-secondary transition-colors group-hover:bg-secondary group-hover:text-on-secondary">
                          <span className="material-symbols-outlined text-[18px]">account_tree</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
                            {nb.name}
                          </span>
                          <span className="block font-label-caps text-label-caps text-on-surface-variant">
                            {nb.documentCount} source{nb.documentCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-outline-variant/60 pt-sm font-label-caps text-label-caps text-on-surface-variant">
                      <span>Updated {formatDate(nb.updatedAt)}</span>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform group-hover:-rotate-45 group-hover:text-secondary">
                        arrow_outward
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {creating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New notebook"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="w-full max-w-sm animate-fade-pop rounded-lg border border-outline-variant bg-surface-container-lowest p-lg shadow-xl">
            <div className="mb-md flex items-start justify-between gap-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">New notebook</h2>
                <p className="mt-xs font-body-ui text-body-ui text-on-surface-variant">
                  Give it a name — you can rename it later.
                </p>
              </div>
              <button
                onClick={closeDialog}
                aria-label="Close"
                className="cursor-pointer rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {createError && (
              <div className="mb-sm flex items-center gap-sm rounded border border-error/30 bg-error-container px-md py-sm text-sm text-on-error-container">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span className="flex-1">{createError}</span>
              </div>
            )}

            <form onSubmit={create}>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Physics 101"
                className="mb-md w-full rounded border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-ui text-body-ui text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none"
              />
              <div className="flex justify-end gap-sm">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={submitting}
                  className="cursor-pointer rounded border border-outline-variant px-lg py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || submitting}
                  className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
