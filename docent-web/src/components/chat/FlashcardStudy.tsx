import { useState } from 'react';
import type { Artifact, DocumentSummary, FlashcardItem } from '../../types';
import CitationPopover from '../CitationPopover';

function filenameFor(docs: DocumentSummary[], documentId: string): string {
  return docs.find((d) => d.id === documentId)?.filename ?? 'Source document';
}

export default function FlashcardStudy({
  artifact,
  docs,
  onExit,
}: {
  artifact: Artifact;
  docs: DocumentSummary[];
  onExit: () => void;
}) {
  const items = (artifact.payload ?? []) as FlashcardItem[];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<Set<number>>(new Set());
  const [restarting, setRestarting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-sm py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-outline-variant">style</span>
        <p className="font-body-ui text-body-ui text-on-surface-variant">This flashcard set is empty.</p>
        <button
          onClick={onExit}
          className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
        >
          Back to artifacts
        </button>
      </div>
    );
  }

  const item = items[index];
  const done = index >= items.length;
  const reviewItems = items.filter((_, i) => review.has(i));

  const advance = () => setIndex((i) => i + 1);
  const markKnown = () => {
    setKnown((s) => new Set(s).add(index));
    setFlipped(false);
    advance();
  };
  const markReview = () => {
    setReview((s) => new Set(s).add(index));
    setFlipped(false);
    advance();
  };
  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setReview(new Set());
    setRestarting(false);
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div className="min-w-0">
          <h3 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {artifact.title}
          </h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Flashcard {Math.min(index + 1, items.length)} of {items.length}
            {review.size > 0 ? ` · ${review.size} to review` : ''}
          </p>
        </div>
        <button
          onClick={onExit}
          className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          Exit
        </button>
      </header>

      <div className="scroll-hidden flex-1 overflow-y-auto p-xl">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-md">
          {done ? (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-24 text-center">
              <span className="material-symbols-outlined text-[44px] text-secondary">task_alt</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Session complete</h4>
              <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
                You know {known.size} card{known.size === 1 ? '' : 's'} and marked {review.size} for
                review.
                {reviewItems.length > 0
                  ? ' Run the review set to lock them in.'
                  : ' No cards left to review — nice work!'}
              </p>
              <div className="mt-sm flex gap-sm">
                {reviewItems.length > 0 && (
                  <button
                    onClick={() => {
                      setReview(new Set());
                      setRestarting(true);
                      setIndex(0);
                      setFlipped(false);
                    }}
                    className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
                  >
                    Review {reviewItems.length} again
                  </button>
                )}
                <button
                  onClick={restart}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Start over
                </button>
                <button
                  onClick={onExit}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-on-surface-variant transition-colors hover:border-secondary"
                >
                  Exit
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFlipped((f) => !f);
                  }
                }}
                className="group relative aspect-[3/2] w-full cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest p-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                style={{ perspective: '1200px' }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-container-lowest p-md transition-transform duration-500"
                  style={{
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <span className="flex h-full w-full flex-col items-center justify-center gap-sm">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">
                      Question
                    </span>
                    <span className="font-headline-md text-headline-md font-medium text-on-surface">
                      {item.question}
                    </span>
                    <span className="font-label-caps text-label-caps text-secondary">
                      Tap to reveal answer
                    </span>
                  </span>
                </span>
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-container-high p-md transition-transform duration-500"
                  style={{
                    transform: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <span className="flex h-full w-full flex-col items-center justify-center gap-sm overflow-hidden">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">
                      Answer
                    </span>
                    <span className="font-body-doc text-body-doc text-on-surface">{item.answer}</span>
                    <span className="flex flex-wrap items-center justify-center gap-1">
                      {item.citations.map((c, i) => (
                        <CitationPopover
                          key={i}
                          citation={c}
                          filename={filenameFor(docs, c.document_id)}
                        />
                      ))}
                    </span>
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-sm">
                <button
                  onClick={() => {
                    setIndex((i) => Math.max(0, i - 1));
                    setFlipped(false);
                  }}
                  disabled={index === 0}
                  className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-md py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Previous
                </button>
                <div className="flex gap-sm">
                  <button
                    onClick={markKnown}
                    className="flex cursor-pointer items-center gap-xs rounded border border-secondary bg-transparent px-md py-sm font-label-caps text-label-caps text-secondary transition-colors hover:bg-secondary/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    I know this
                  </button>
                  <button
                    onClick={markReview}
                    className="flex cursor-pointer items-center gap-xs rounded bg-primary px-md py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    Review again
                  </button>
                </div>
                <button
                  onClick={() => {
                    setIndex((i) => Math.min(items.length - 1, i + 1));
                    setFlipped(false);
                  }}
                  disabled={index === items.length - 1}
                  className="flex cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-md py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
              <div className="text-center font-label-caps text-label-caps text-on-surface-variant">
                {restarting
                  ? 'Reviewing the cards you flagged.'
                  : 'Known: ' + known.size + ' · Review: ' + review.size}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}