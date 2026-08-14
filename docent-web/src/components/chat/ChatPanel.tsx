import { useEffect, useRef, useState } from 'react';
import { queryDocuments } from '../../api/client';
import type { ChatMessage, DocumentSummary } from '../../types';
import MessageBubble from './MessageBubble';

const SUGGESTIONS = [
  'Summarize the key ideas across these documents.',
  'What are the main risks or limitations mentioned?',
  'List the concrete examples given with page references.',
];

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;

function LoadingBubble() {
  return (
    <div className="flex w-full gap-md">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-on-primary">
        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm">
        <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant" />
        <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant" />
        <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant" />
      </div>
    </div>
  );
}

interface Props {
  selectedDocs: DocumentSummary[];
  allDocs: DocumentSummary[];
  onClearContext: () => void;
  loadError?: string | null;
}

export default function ChatPanel({ selectedDocs, allDocs, onClearContext, loadError }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const canAsk = selectedDocs.length > 0 && !loading;

  const submit = async (text?: string, fromRetry = false) => {
    const question = (text ?? input).trim();
    if (!question || !canAsk) return;
    const ids = selectedDocs.map((d) => d.id);
    if (!fromRetry) {
      setMessages((m) => [...m, { id: nextId(), role: 'user', content: question }]);
      setInput('');
    }
    setError(null);
    setLoading(true);
    try {
      const res = await queryDocuments(question, ids);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
          confidence: res.confidence,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError({ message, question });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const retry = () => {
    if (!error || !canAsk) return;
    void submit(error.question, true);
  };

  const hasMessages = messages.length > 0 || loading;

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col bg-surface">
      <div ref={scrollRef} className="scroll-hidden flex-1 overflow-y-auto p-xl">
        {!hasMessages ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-md text-center">
            <div className="animate-rise flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-secondary">
              <span className="material-symbols-outlined text-[32px]">chat_bubble</span>
            </div>
            <div className="animate-rise">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Ask anything about your documents
              </h3>
              <p className="mt-1 font-body-ui text-body-ui text-on-surface-variant">
                Answers are grounded in your sources with inline citations.
              </p>
            </div>
            <div className="animate-rise flex max-w-md flex-wrap justify-center gap-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void submit(s)}
                  disabled={!canAsk}
                  className="cursor-pointer rounded-full border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-ui text-body-ui text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-xl pb-40">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} docs={allDocs} />
            ))}
            {loading && <LoadingBubble />}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 w-full bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest to-transparent p-md pt-xl">
        <div className="mx-auto max-w-[720px]">
          {(loadError || error) && (
            <div className="mb-2 flex items-center gap-sm rounded-lg border border-error/30 bg-error-container px-md py-sm font-body-ui text-body-ui text-on-error-container">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="flex-1">{loadError ?? error?.message}</span>
              {error && (
                <button
                  onClick={retry}
                  disabled={!canAsk}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-error/40 bg-transparent px-sm py-1 font-label-caps text-label-caps text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  Retry
                </button>
              )}
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss"
                className="shrink-0 cursor-pointer rounded p-1 transition-colors hover:bg-error/10"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          <div className="input-glow flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-xs shadow-sm">
            <div className="mb-xs flex items-center justify-between border-b border-outline-variant/40 px-sm pb-1 pt-xs">
              <span className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant opacity-80">
                <span className="material-symbols-outlined text-[14px]">plagiarism</span>
                Querying {selectedDocs.length} document{selectedDocs.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={onClearContext}
                className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-secondary hover:underline"
              >
                Clear Context
              </button>
            </div>
            <div className="flex items-end gap-sm p-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={
                  selectedDocs.length === 0
                    ? 'Select documents in the context scope to ask a question…'
                    : 'Ask a question about the selected documents…'
                }
                className="max-h-[120px] flex-1 resize-none border-none bg-transparent p-0 font-body-ui text-body-ui text-on-surface placeholder:text-on-surface-variant focus:ring-0 focus:outline-none"
              />
              <button
                onClick={() => void submit()}
                disabled={!canAsk}
                aria-label="Send"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
          <p className="mt-xs text-center font-label-caps text-label-caps text-on-surface-variant opacity-50">
            Docent AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </section>
  );
}