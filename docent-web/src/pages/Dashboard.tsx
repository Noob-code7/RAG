import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNotebooks } from '../api/client';
import type { Notebook } from '../types';
import AppNavbar from '../components/app/AppNavbar';
import { useSettings } from '../context/SettingsContext';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const { settings } = useSettings();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listNotebooks()
      .then(setNotebooks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, []);

  const totalSources = notebooks.reduce((sum, n) => sum + n.documentCount, 0);
  const mostRecent = [...notebooks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const activity = [...notebooks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((n) => ({
      icon: 'account_tree',
      title: n.name,
      detail: `${n.documentCount} source${n.documentCount === 1 ? '' : 's'}`,
      time: timeAgo(n.updatedAt),
      to: `/notebooks/${n.id}`,
    }));

  const first = settings.profile.name.split(/\s+/)[0];

  const stats = [
    { label: 'Notebooks', value: String(notebooks.length), icon: 'folder', to: '/' },
    { label: 'Total sources', value: String(totalSources), icon: 'description', to: '/' },
    {
      label: 'Most recently updated',
      value: mostRecent ? timeAgo(mostRecent.updatedAt) : '—',
      icon: 'history',
      to: mostRecent ? `/notebooks/${mostRecent.id}` : '/',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-ui text-on-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-md pb-16 pt-24 md:px-lg">
        <header className="mb-xl">
          <h1 className="mb-sm font-display-lg text-display-lg text-on-surface">Welcome back, {first}</h1>
          <p className="max-w-2xl font-body-doc text-body-doc text-on-surface-variant">
            Here’s what’s happening across your notebooks today. Each notebook keeps its sources isolated.
          </p>
        </header>

        {error && (
          <div className="mb-md flex items-center gap-sm rounded-lg border border-error/30 bg-error-container px-md py-sm text-sm text-on-error-container">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <section className="mb-md grid grid-cols-1 gap-md sm:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-secondary"
            >
              <span className="material-symbols-outlined mb-sm block text-[22px] text-secondary">{s.icon}</span>
              <p className="truncate font-headline-md text-headline-md font-bold text-on-surface" title={s.value}>
                {s.value}
              </p>
              <p className="font-label-caps text-label-caps text-on-surface-variant">{s.label}</p>
            </Link>
          ))}
        </section>

        <section className="mb-md grid grid-cols-1 gap-md lg:grid-cols-3">
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md lg:col-span-2">
            <div className="mb-md flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Recently updated</h2>
              <Link
                to="/"
                className="font-label-caps text-label-caps text-secondary transition-colors hover:text-primary"
              >
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="font-body-ui text-body-ui text-on-surface-variant">
                No notebooks yet — create one to get started.
              </p>
            ) : (
              <ul className="flex flex-col">
                {activity.map((a, i) => (
                  <li key={i} className="border-b border-outline-variant/50 py-sm last:border-b-0">
                    <Link
                      to={a.to}
                      className="flex items-center gap-sm transition-colors hover:text-secondary"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">{a.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body-ui text-body-ui text-on-surface" title={a.title}>
                          {a.title}
                        </span>
                        <span className="block font-label-caps text-label-caps text-on-surface-variant">
                          {a.detail}
                        </span>
                      </span>
                      <span className="shrink-0 font-label-caps text-label-caps text-on-surface-variant">
                        {a.time}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-md">
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
              <h2 className="mb-sm font-headline-sm text-headline-sm text-on-surface">Notebooks</h2>
              {notebooks.length === 0 ? (
                <p className="font-body-ui text-body-ui text-on-surface-variant">Nothing here yet.</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {notebooks.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <Link
                        to={`/notebooks/${n.id}`}
                        className="flex items-center justify-between rounded px-sm py-1 font-body-ui text-body-ui transition-colors hover:bg-surface-container"
                      >
                        <span className="truncate text-on-surface">{n.name}</span>
                        <span className="shrink-0 text-on-surface-variant">{n.documentCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-sm">
              <Link
                to="/"
                className="flex items-center justify-center gap-sm rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                New Notebook
              </Link>
              {mostRecent && (
                <Link
                  to={`/notebooks/${mostRecent.id}`}
                  className="flex items-center justify-center gap-sm rounded border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                  Open latest notebook
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}