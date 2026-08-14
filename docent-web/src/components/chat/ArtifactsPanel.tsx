import { useCallback, useEffect, useState } from 'react';
import {
  downloadDataTable,
  downloadReport,
  generateDataTable,
  generateFlashcards,
  generateMindMap,
  generateQuiz,
  generateReport,
  getNotebookArtifacts,
} from '../../api/client';
import type { Artifact, Difficulty, DocumentSummary } from '../../types';
import FlashcardStudy from './FlashcardStudy';
import QuizTake from './QuizTake';
import MindMapView from './MindMapView';
import ReportView from './ReportView';
import DataTableView from './DataTableView';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const ICONS: Record<Artifact['type'], string> = {
  saved_note: 'bookmark',
  flashcard_set: 'style',
  quiz: 'quiz',
  mind_map: 'account_tree',
  report: 'description',
  data_table: 'table',
};

function topicFromTitle(type: Artifact['type'], title: string): string {
  const prefix =
    type === 'flashcard_set'
      ? 'Flashcards: '
      : type === 'mind_map'
        ? 'Mind map: '
        : type === 'quiz'
          ? 'Quiz: '
          : type === 'report'
            ? 'Report: '
            : type === 'data_table'
              ? 'Data table: '
              : 'Saved note: ';
  return title.startsWith(prefix) ? title.slice(prefix.length) : '';
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type GenerateKind = 'flashcards' | 'quiz' | 'mind-map' | 'report' | 'data-table';

export default function ArtifactsPanel({
  notebookId,
  docs,
  onBack,
}: {
  notebookId: string;
  docs: DocumentSummary[];
  onBack: () => void;
}) {
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateKind, setGenerateKind] = useState<GenerateKind | null>(null);
  const [generatePrefill, setGeneratePrefill] = useState<{ topic: string; count: number } | null>(null);
  const [active, setActive] = useState<{
    kind: 'study' | 'quiz' | 'mind-map' | 'report' | 'data-table';
    artifact: Artifact;
  } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const openGenerate = (kind: GenerateKind, prefill?: { topic: string; count: number }) => {
    setGeneratePrefill(prefill ?? null);
    setGenerateKind(kind);
  };

  const handleExport = async (artifact: Artifact, format: 'pdf' | 'md' | 'xlsx' | 'csv') => {
    setExportingId(artifact.id);
    try {
      if (artifact.type === 'report') {
        await downloadReport(artifact.notebookId, artifact.id, format as 'pdf' | 'md');
      } else if (artifact.type === 'data_table') {
        await downloadDataTable(artifact.notebookId, artifact.id, format as 'xlsx' | 'csv');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setArtifacts(await getNotebookArtifacts(notebookId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
    }
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;
    setArtifacts(null);
    setError(null);
    getNotebookArtifacts(notebookId)
      .then((list) => {
        if (!cancelled) setArtifacts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load artifacts');
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const readyIds = docs.filter((d) => d.status === 'ready').map((d) => d.id);

  if (active) {
    if (active.kind === 'study') {
      return <FlashcardStudy artifact={active.artifact} docs={docs} onExit={() => setActive(null)} />;
    }
    if (active.kind === 'quiz') {
      return <QuizTake artifact={active.artifact} docs={docs} onExit={() => setActive(null)} />;
    }
    if (active.kind === 'report') {
      return (
        <ReportView
          notebookId={notebookId}
          artifact={active.artifact}
          docs={docs}
          onExit={() => setActive(null)}
        />
      );
    }
    if (active.kind === 'data-table') {
      return (
        <DataTableView
          notebookId={notebookId}
          artifact={active.artifact}
          docs={docs}
          onExit={() => setActive(null)}
        />
      );
    }
    return <MindMapView artifact={active.artifact} docs={docs} onExit={() => setActive(null)} />;
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Artifacts</h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Notes, flashcards, quizzes, and reports generated from this notebook
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => openGenerate('data-table')}
            disabled={readyIds.length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">table</span>
            New data table
          </button>
          <button
            onClick={() => openGenerate('report')}
            disabled={readyIds.length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            New report
          </button>
          <button
            onClick={() => openGenerate('mind-map')}
            disabled={readyIds.length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">account_tree</span>
            New mind map
          </button>
          <button
            onClick={() => openGenerate('flashcards')}
            disabled={readyIds.length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-secondary bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">style</span>
            New flashcards
          </button>
          <button
            onClick={() => openGenerate('quiz')}
            disabled={readyIds.length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded bg-primary px-sm py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">quiz</span>
            New quiz
          </button>
          <button
            onClick={onBack}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to chat
          </button>
        </div>
      </header>

      <div className="scroll-hidden flex-1 overflow-y-auto p-xl">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-sm py-24 text-center">
            <span className="material-symbols-outlined text-[36px] text-error">error</span>
            <p className="font-body-ui text-body-ui text-error">{error}</p>
          </div>
        ) : artifacts === null ? (
          <div className="flex items-center justify-center gap-sm py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] animate-pulse">bookmarks</span>
            <span className="font-body-ui text-body-ui">Loading artifacts…</span>
          </div>
        ) : artifacts.length === 0 ? (
          <div className="mx-auto flex w-full max-w-[720px] flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-md py-24 text-center">
            <span className="material-symbols-outlined text-[44px] text-outline-variant">auto_stories</span>
            <h4 className="font-headline-md text-headline-md text-on-surface">No artifacts yet</h4>
            <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
              Save a chat answer as a note, or generate flashcards, quizzes, data tables, and a
              study guide to master this notebook&rsquo;s documents.
            </p>
            {readyIds.length === 0 ? (
              <p className="font-label-caps text-label-caps text-on-surface-variant">
                Upload and index at least one document before generating study material.
              </p>
            ) : (
              <div className="mt-sm flex flex-wrap justify-center gap-sm">
                <button
                  onClick={() => openGenerate('data-table')}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Generate data table
                </button>
                <button
                  onClick={() => openGenerate('report')}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Generate report
                </button>
                <button
                  onClick={() => openGenerate('flashcards')}
                  className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
                >
                  Generate flashcards
                </button>
                <button
                  onClick={() => openGenerate('quiz')}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Generate quiz
                </button>
                <button
                  onClick={() => openGenerate('mind-map')}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Generate mind map
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-[720px] flex-col gap-md">
            {artifacts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
              >
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex min-w-0 items-start gap-sm">
                    <span className="material-symbols-outlined text-[22px] text-secondary">
                      {ICONS[a.type]}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                        {a.title}
                      </h4>
                      <p className="font-label-caps text-label-caps text-on-surface-variant">
                        {a.type === 'saved_note'
                          ? `Note · ${formatDate(a.createdAt)}`
                          : a.type === 'flashcard_set'
                            ? `Flashcards (${(a.payload as unknown[] | null)?.length ?? 0}) · ${formatDate(a.createdAt)}`
                            : a.type === 'quiz'
                              ? `Quiz (${(a.payload as unknown[] | null)?.length ?? 0}) · ${formatDate(a.createdAt)}`
                              : a.type === 'report'
                                ? `Report · ${formatDate(a.createdAt)}`
                                : a.type === 'data_table'
                                  ? `Data table (${((a.payload as { rows?: unknown[] } | null)?.rows?.length ?? 0)}) · ${formatDate(a.createdAt)}`
                                  : `Mind map · ${formatDate(a.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  {a.type !== 'saved_note' && (
                    <div className="flex shrink-0 items-center gap-sm">
                      {a.type === 'report' && (
                        <>
                          <button
                            onClick={() => void handleExport(a, 'md')}
                            disabled={exportingId !== null}
                            className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {exportingId === a.id ? 'progress_activity animate-spin' : 'download'}
                            </span>
                            Export MD
                          </button>
                          <button
                            onClick={() => void handleExport(a, 'pdf')}
                            disabled={exportingId !== null}
                            className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {exportingId === a.id ? 'progress_activity animate-spin' : 'picture_as_pdf'}
                            </span>
                            Export PDF
                          </button>
                        </>
                      )}
                      {a.type === 'data_table' && (
                        <>
                          <button
                            onClick={() => void handleExport(a, 'csv')}
                            disabled={exportingId !== null}
                            className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {exportingId === a.id ? 'progress_activity animate-spin' : 'download'}
                            </span>
                            Export CSV
                          </button>
                          <button
                            onClick={() => void handleExport(a, 'xlsx')}
                            disabled={exportingId !== null}
                            className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {exportingId === a.id ? 'progress_activity animate-spin' : 'grid_on'}
                            </span>
                            Export XLSX
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          openGenerate(
                            a.type === 'flashcard_set'
                              ? 'flashcards'
                              : a.type === 'quiz'
                                ? 'quiz'
                                : a.type === 'mind_map'
                                  ? 'mind-map'
                                  : a.type === 'report'
                                    ? 'report'
                                    : 'data-table',
                            {
                              topic: topicFromTitle(a.type, a.title),
                              count: 6,
                            },
                          )
                        }
                        className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Generate more
                      </button>
                      <button
                        onClick={() =>
                          setActive({
                            kind:
                              a.type === 'flashcard_set'
                                ? 'study'
                                : a.type === 'quiz'
                                  ? 'quiz'
                                  : a.type === 'mind_map'
                                    ? 'mind-map'
                                    : a.type === 'report'
                                      ? 'report'
                                      : 'data-table',
                            artifact: a,
                          })
                        }
                        className="flex cursor-pointer items-center gap-xs rounded border border-secondary bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:bg-secondary/10"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {a.type === 'flashcard_set'
                            ? 'style'
                            : a.type === 'quiz'
                              ? 'quiz'
                              : a.type === 'mind_map'
                                ? 'account_tree'
                                : a.type === 'report'
                                  ? 'description'
                                  : 'table'}
                        </span>
                        {a.type === 'flashcard_set'
                          ? 'Study'
                          : a.type === 'quiz'
                            ? 'Take quiz'
                            : a.type === 'mind_map'
                              ? 'Open map'
                              : a.type === 'report'
                                ? 'Read report'
                                : 'Open table'}
                      </button>
                    </div>
                  )}
                </div>
                {a.type === 'saved_note' && (
                  <>
                    <p className="mt-sm whitespace-pre-wrap font-body-doc text-body-doc text-on-surface">
                      {a.content}
                    </p>
                    {a.citations && a.citations.length > 0 && (
                      <p className="mt-sm font-label-caps text-label-caps text-on-surface-variant">
                        {a.citations.length} citation{a.citations.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {generateKind && (
        <GenerateDialog
          kind={generateKind}
          readyCount={readyIds.length}
          prefill={generatePrefill}
          onCancel={() => {
            setGenerateKind(null);
            setGeneratePrefill(null);
          }}
          onGenerate={async (form) => {
            const opts = {
              documentIds: readyIds,
              topic: form.topic || undefined,
              difficulty: form.difficulty,
              count: form.count,
              ...(generateKind === 'data-table' ? { columnsHint: form.topic || undefined } : {}),
            };
            const artifact =
              generateKind === 'flashcards'
                ? await generateFlashcards(notebookId, opts)
                : generateKind === 'quiz'
                  ? await generateQuiz(notebookId, opts)
                  : generateKind === 'mind-map'
                    ? await generateMindMap(notebookId, opts)
                    : generateKind === 'report'
                      ? await generateReport(notebookId, opts)
                      : await generateDataTable(notebookId, opts);
            setGenerateKind(null);
            setGeneratePrefill(null);
            await load();
            setActive({
              kind:
                generateKind === 'flashcards'
                  ? 'study'
                  : generateKind === 'quiz'
                    ? 'quiz'
                    : generateKind === 'mind-map'
                      ? 'mind-map'
                      : generateKind === 'report'
                        ? 'report'
                        : 'data-table',
              artifact,
            });
          }}
        />
      )}
    </section>
  );
}

interface GenerateForm {
  topic: string;
  difficulty: Difficulty;
  count: number;
}

function GenerateDialog({
  kind,
  readyCount,
  prefill,
  onCancel,
  onGenerate,
}: {
  kind: GenerateKind;
  readyCount: number;
  prefill: { topic: string; count: number } | null;
  onCancel: () => void;
  onGenerate: (form: GenerateForm) => Promise<void>;
}) {
  const isMindMap = kind === 'mind-map';
  const isReport = kind === 'report';
  const isDataTable = kind === 'data-table';
  const hideExtras = isMindMap || isReport || isDataTable;
  const [topic, setTopic] = useState(prefill?.topic ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(prefill?.count ?? (hideExtras ? 10 : 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (readyCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onGenerate({ topic, difficulty, count });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-md">
      <div className="w-full max-w-[460px] rounded-lg border border-outline-variant bg-surface-container-lowest p-lg shadow-lg">
        <div className="mb-md flex items-center justify-between gap-sm">
          <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            {kind === 'flashcards'
              ? 'Generate flashcards'
              : kind === 'quiz'
                ? 'Generate quiz'
                : kind === 'mind-map'
                  ? 'Generate mind map'
                  : kind === 'report'
                    ? 'Generate report'
                    : 'Generate data table'}
          </h4>
          <button
            onClick={onCancel}
            className="flex cursor-pointer items-center rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-md">
          <label className="flex flex-col gap-xs font-label-caps text-label-caps text-on-surface-variant">
            {isDataTable
              ? 'Columns hint (optional)'
              : isReport
                ? 'Focus (optional)'
                : 'Topic (optional)'}
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isDataTable
                  ? 'e.g. extract dates, events, and outcomes'
                  : isReport
                    ? 'e.g. Database recovery mechanisms'
                    : isMindMap
                      ? 'e.g. Overview of the chapter'
                      : 'e.g. Chunking and retrieval'
              }
              className="rounded border border-outline-variant bg-surface px-sm py-sm font-body-ui text-body-ui text-on-surface focus:border-secondary focus:outline-none"
            />
          </label>

          {isDataTable && (
            <p className="font-body-ui text-body-ui text-on-surface-variant">
              The table only includes rows the source genuinely supports — if the document has no
              such structured data, the table will come back empty.
            </p>
          )}

          {!hideExtras && (
            <div className="flex gap-md">
              <label className="flex flex-1 flex-col gap-xs font-label-caps text-label-caps text-on-surface-variant">
                Difficulty
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="rounded border border-outline-variant bg-surface px-sm py-sm font-body-ui text-body-ui text-on-surface focus:border-secondary focus:outline-none"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-xs font-label-caps text-label-caps text-on-surface-variant">
                Count
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  className="rounded border border-outline-variant bg-surface px-sm py-sm font-body-ui text-body-ui text-on-surface focus:border-secondary focus:outline-none"
                />
              </label>
            </div>
          )}

          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Generated from {readyCount} ready document{readyCount === 1 ? '' : 's'} in this notebook.
          </p>

          {error && <p className="font-body-ui text-body-ui text-error">{error}</p>}

          <div className="flex justify-end gap-sm">
            <button
              onClick={onCancel}
              disabled={busy}
              className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={busy || readyCount === 0}
              className="flex cursor-pointer items-center gap-xs rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  Generating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}