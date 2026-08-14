import { useState } from 'react';
import type { ChatMessage, Citation, DocumentSummary } from '../../types';
import ConfidenceIndicator from '../ConfidenceIndicator';
import CitationPopover from '../CitationPopover';
import { useToast } from '../ui/Toast';
import ProfileAvatar from '../app/ProfileAvatar';

function splitAnswer(answer: string, citations: Citation[], docs: DocumentSummary[]) {
  const filenameFor = (documentId: string) =>
    docs.find((d) => d.id === documentId)?.filename ?? 'Source document';

  const parts: React.ReactNode[] = [];
  const re = /\[Source\s+(\d+)[^\]]*\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(answer)) !== null) {
    if (m.index > last) {
      parts.push(<span key={key++}>{answer.slice(last, m.index)}</span>);
    }
    const n = Number(m[1]);
    const citation = citations.find((c) => c.source_label === `[Source ${n}]`);
    if (citation) {
      parts.push(
        <CitationPopover key={key++} citation={citation} filename={filenameFor(citation.document_id)} />,
      );
    } else {
      parts.push(<span key={key++}>{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < answer.length) {
    parts.push(<span key={key++}>{answer.slice(last)}</span>);
  }
  return parts;
}

export default function MessageBubble({
  message,
  docs,
  onSaveAsNote,
}: {
  message: ChatMessage;
  docs: DocumentSummary[];
  onSaveAsNote?: (messageId: string) => void;
}) {
  const push = useToast();
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      push('Answer copied to clipboard.');
    } catch {
      push('Could not copy — your browser blocked clipboard access.');
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex w-full justify-end gap-md">
        <div className="max-w-[85%] rounded-lg rounded-tr-sm border border-outline-variant bg-surface-container-high px-md py-sm text-on-surface">
          <p className="font-body-doc text-body-doc">{message.content}</p>
        </div>
        <ProfileAvatar size={32} className="mt-0.5 shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex w-full gap-md">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-on-primary">
        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
      </div>
      <div className="flex max-w-[90%] flex-col gap-sm">
        <div className="flex items-center gap-sm">
          <span className="font-label-caps text-label-caps text-on-surface-variant">Docent AI</span>
          {message.confidence && <ConfidenceIndicator confidence={message.confidence} />}
        </div>
        <div className="font-body-doc text-body-doc leading-relaxed text-on-surface">
          {splitAnswer(message.content, message.citations ?? [], docs)}
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => void copyAnswer()}
            className="flex cursor-pointer items-center gap-1 rounded border border-outline-variant bg-transparent px-sm py-1 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            Copy
          </button>
          {onSaveAsNote && (
            <button
              onClick={() => onSaveAsNote(message.id)}
              className="flex cursor-pointer items-center gap-1 rounded border border-outline-variant bg-transparent px-sm py-1 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
              Save as note
            </button>
          )}
          <button
            onClick={() => {
              setFeedback(feedback === 'up' ? null : 'up');
              if (feedback !== 'up') push('Thanks for the feedback!');
            }}
            aria-pressed={feedback === 'up'}
            className={`flex cursor-pointer items-center gap-1 rounded border px-sm py-1 font-label-caps text-label-caps transition-colors ${
              feedback === 'up'
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {feedback === 'up' ? 'thumb_up' : 'thumb_up_off_alt'}
            </span>
            Helpful
          </button>
          <button
            onClick={() => {
              setFeedback(feedback === 'down' ? null : 'down');
              if (feedback !== 'down') push('Thanks — we’ll use this to improve.');
            }}
            aria-pressed={feedback === 'down'}
            className={`flex cursor-pointer items-center gap-1 rounded border px-sm py-1 font-label-caps text-label-caps transition-colors ${
              feedback === 'down'
                ? 'border-error bg-error/10 text-error'
                : 'border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {feedback === 'down' ? 'thumb_down' : 'thumb_down_off_alt'}
            </span>
            Not helpful
          </button>
        </div>
      </div>
    </div>
  );
}