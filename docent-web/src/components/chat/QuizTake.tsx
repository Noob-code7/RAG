import { useState } from 'react';
import type { Artifact, DocumentSummary, QuizItem } from '../../types';
import CitationPopover from '../CitationPopover';

function filenameFor(docs: DocumentSummary[], documentId: string): string {
  return docs.find((d) => d.id === documentId)?.filename ?? 'Source document';
}

export default function QuizTake({
  artifact,
  docs,
  onExit,
}: {
  artifact: Artifact;
  docs: DocumentSummary[];
  onExit: () => void;
}) {
  const items = (artifact.payload ?? []) as QuizItem[];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-sm py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-outline-variant">quiz</span>
        <p className="font-body-ui text-body-ui text-on-surface-variant">This quiz is empty.</p>
        <button
          onClick={onExit}
          className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
        >
          Back to artifacts
        </button>
      </div>
    );
  }

  const finished = index >= items.length;
  const item = items[index];
  const score = answers.reduce<number>(
    (acc, a, i) => acc + (a !== null && a === items[i].correct_index ? 1 : 0),
    0,
  );
  const answered = picked !== null;

  const choose = (oi: number) => {
    if (answered) return;
    setPicked(oi);
    setAnswers((arr) => arr.map((a, i) => (i === index ? oi : a)));
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const retake = () => {
    setPicked(null);
    setIndex(0);
    setAnswers(items.map(() => null));
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div className="min-w-0">
          <h3 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {artifact.title}
          </h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Question {Math.min(index + 1, items.length)} of {items.length}
            {finished ? ` · Score ${score}/${items.length}` : ''}
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
          {finished ? (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-24 text-center">
              <span
                className={`material-symbols-outlined text-[44px] ${
                  score === items.length ? 'text-secondary' : 'text-primary'
                }`}
              >
                {score === items.length ? 'military_tech' : 'flag'}
              </span>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                You scored {score}/{items.length}
              </h4>
              <p className="max-w-sm font-body-ui text-body-ui text-on-surface-variant">
                {score === items.length
                  ? 'Perfect score — everything is grounded and clear.'
                  : 'Review the missed questions below to close the gaps.'}
              </p>
              {answers.some((a, i) => a !== items[i].correct_index) && (
                <ul className="mt-sm w-full max-w-md space-y-sm text-left">
                  {items.map((q, i) =>
                    answers[i] !== q.correct_index ? (
                      <li
                        key={i}
                        className="rounded border border-outline-variant bg-surface-container-lowest p-sm"
                      >
                        <p className="font-body-ui text-body-ui text-on-surface">{q.question}</p>
                        <p className="mt-xs font-body-ui text-body-ui text-secondary">
                          Correct: {q.options[q.correct_index]}
                        </p>
                        <p className="mt-xs font-body-ui text-[12px] leading-5 text-on-surface-variant">
                          {q.explanation}
                        </p>
                        <p className="mt-xs flex flex-wrap items-center gap-1">
                          {q.citations.map((c, ci) => (
                            <CitationPopover
                              key={ci}
                              citation={c}
                              filename={filenameFor(docs, c.document_id)}
                            />
                          ))}
                        </p>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
              <div className="mt-sm flex gap-sm">
                <button
                  onClick={retake}
                  className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
                >
                  Retake
                </button>
                <button
                  onClick={onExit}
                  className="cursor-pointer rounded border border-outline-variant bg-transparent px-lg py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
                >
                  Exit
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
                <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {item.question}
                </h4>
                <ul className="mt-md flex flex-col gap-sm">
                  {item.options.map((opt, oi) => {
                    const isCorrect = oi === item.correct_index;
                    const isPicked = picked === oi;
                    let cls = 'border-outline-variant bg-surface-container-lowest hover:border-secondary';
                    let icon: string | null = null;
                    if (answered) {
                      if (isCorrect) {
                        cls = 'border-secondary bg-secondary/10 text-on-surface';
                        icon = 'check_circle';
                      } else if (isPicked) {
                        cls = 'border-error bg-error/10 text-on-surface';
                        icon = 'cancel';
                      } else {
                        cls = 'border-outline-variant bg-surface-container-lowest opacity-60';
                      }
                    }
                    return (
                      <li key={oi}>
                        <button
                          onClick={() => choose(oi)}
                          disabled={answered}
                          className={`flex w-full cursor-pointer items-center gap-sm rounded border px-md py-sm text-left font-body-ui text-body-ui text-on-surface transition-colors disabled:cursor-default ${cls}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-label-caps text-label-caps">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {icon && (
                            <span className="material-symbols-outlined text-[18px] text-secondary">
                              {icon}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {answered && (
                  <div className="mt-md rounded border border-outline-variant bg-surface-container-lowest p-sm">
                    <p className="font-body-ui text-body-ui text-on-surface">
                      {picked === item.correct_index ? (
                        <span className="text-secondary">Correct!</span>
                      ) : (
                        <>
                          <span className="text-error">Not quite.</span>{' '}
                          <span className="text-on-surface-variant">
                            The answer is {item.options[item.correct_index]}.
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-xs font-body-ui text-[12px] leading-5 text-on-surface-variant">
                      {item.explanation}
                    </p>
                    <p className="mt-xs flex flex-wrap items-center gap-1">
                      {item.citations.map((c, ci) => (
                        <CitationPopover
                          key={ci}
                          citation={c}
                          filename={filenameFor(docs, c.document_id)}
                        />
                      ))}
                    </p>
                  </div>
                )}

                <div className="mt-md flex justify-end">
                  <button
                    onClick={next}
                    disabled={!answered}
                    className="flex cursor-pointer items-center gap-xs rounded bg-primary px-md py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {index === items.length - 1 ? 'See results' : 'Next'}
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}