import { Fragment, useState, type ReactNode } from 'react';
import { marked, type Token, type Tokens } from 'marked';
import type { Artifact, Citation, DocumentSummary } from '../../types';
import CitationPopover from '../CitationPopover';
import { downloadReport } from '../../api/client';

function filenameFor(documentId: string, docs: DocumentSummary[]): string {
  return docs.find((d) => d.id === documentId)?.filename ?? 'Source document';
}

function renderTextWithCitations(
  text: string,
  citations: Citation[],
  docs: DocumentSummary[],
  keyBase: string,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[Source\s+(\d+)[^\]]*\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`${keyBase}-t${key++}`}>{text.slice(last, m.index)}</span>);
    }
    const n = Number(m[1]);
    const citation = citations.find((c) => c.source_label === `[Source ${n}]`);
    if (citation) {
      parts.push(
        <CitationPopover
          key={`${keyBase}-c${key++}`}
          citation={citation}
          filename={filenameFor(citation.document_id, docs)}
        />,
      );
    } else {
      parts.push(<span key={`${keyBase}-t${key++}`}>{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<span key={`${keyBase}-t${key++}`}>{text.slice(last)}</span>);
  }
  return parts;
}

function renderInline(
  tokens: Token[] | undefined,
  citations: Citation[],
  docs: DocumentSummary[],
  keyBase: string,
): ReactNode {
  return (tokens ?? []).map((t, i) => {
    const key = `${keyBase}-${i}`;
    switch (t.type) {
      case 'text':
        return <Fragment key={key}>{renderTextWithCitations(t.text, citations, docs, key)}</Fragment>;
      case 'strong':
        return <strong key={key}>{renderInline(t.tokens, citations, docs, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(t.tokens, citations, docs, key)}</em>;
      case 'del':
        return <del key={key}>{renderInline(t.tokens, citations, docs, key)}</del>;
      case 'codespan':
        return <code key={key}>{t.text}</code>;
      case 'link':
        return (
          <a key={key} href={t.href} target="_blank" rel="noreferrer" className="text-secondary underline">
            {renderInline(t.tokens, citations, docs, key)}
          </a>
        );
      case 'br':
        return <br key={key} />;
      default:
        return <Fragment key={key}>{String((t as { raw?: string }).raw ?? '')}</Fragment>;
    }
  });
}

function renderBlocks(
  tokens: Token[],
  citations: Citation[],
  docs: DocumentSummary[],
  keyBase: string,
): ReactNode[] {
  return tokens.map((t, i) => {
    const key = `${keyBase}-${i}`;
    switch (t.type) {
      case 'heading': {
        const heading = t as Tokens.Heading;
        const Heading = heading.depth <= 1 ? 'h2' : heading.depth === 2 ? 'h3' : 'h4';
        return (
          <Heading
            key={key}
            className="mt-lg font-headline-sm text-headline-sm font-semibold text-on-surface"
          >
            {renderInline(heading.tokens, citations, docs, key)}
          </Heading>
        );
      }
      case 'paragraph':
        return (
          <p key={key} className="font-body-doc text-body-doc leading-relaxed text-on-surface">
            {renderInline((t as Tokens.Paragraph).tokens, citations, docs, key)}
          </p>
        );
      case 'list': {
        const list = t as Tokens.List;
        const items = list.items.map((item, j) => (
          <li key={j}>{renderBlocks(item.tokens ?? [], citations, docs, `${key}-li${j}`)}</li>
        ));
        return list.ordered ? (
          <ol key={key} className="ml-lg list-decimal space-y-xs font-body-doc text-body-doc text-on-surface">
            {items}
          </ol>
        ) : (
          <ul key={key} className="ml-lg list-disc space-y-xs font-body-doc text-body-doc text-on-surface">
            {items}
          </ul>
        );
      }
      case 'blockquote':
        return (
          <blockquote
            key={key}
            className="border-l-2 border-outline-variant pl-sm font-body-doc text-body-doc text-on-surface-variant"
          >
            {renderBlocks((t as Tokens.Blockquote).tokens, citations, docs, key)}
          </blockquote>
        );
      case 'code':
        return (
          <pre
            key={key}
            className="overflow-x-auto rounded border border-outline-variant bg-surface-container px-sm py-sm font-body-doc text-body-doc text-on-surface"
          >
            <code>{(t as Tokens.Code).text}</code>
          </pre>
        );
      case 'hr':
        return <hr key={key} className="my-md border-outline-variant" />;
      case 'space':
        return null;
      case 'text':
        return <Fragment key={key}>{renderTextWithCitations(t.text, citations, docs, key)}</Fragment>;
      default:
        return <Fragment key={key}>{String((t as { raw?: string }).raw ?? '')}</Fragment>;
    }
  });
}

export default function ReportView({
  notebookId,
  artifact,
  docs,
  onExit,
}: {
  notebookId: string;
  artifact: Artifact;
  docs: DocumentSummary[];
  onExit: () => void;
}) {
  const [busy, setBusy] = useState<'pdf' | 'md' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = async (format: 'pdf' | 'md') => {
    setBusy(format);
    setError(null);
    try {
      await downloadReport(notebookId, artifact.id, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const tokens = marked.lexer(artifact.content ?? '');

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div className="min-w-0">
          <h3 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {artifact.title}
          </h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Study guide · rendered from Markdown
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <button
            onClick={() => void onExport('md')}
            disabled={busy !== null}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">
              {busy === 'md' ? 'progress_activity animate-spin' : 'download'}
            </span>
            Export MD
          </button>
          <button
            onClick={() => void onExport('pdf')}
            disabled={busy !== null}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded bg-primary px-sm py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">
              {busy === 'pdf' ? 'progress_activity animate-spin' : 'picture_as_pdf'}
            </span>
            Export PDF
          </button>
          <button
            onClick={onExit}
            className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </button>
        </div>
      </header>

      <div className="scroll-hidden flex-1 overflow-y-auto p-xl">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-sm">
          {error && <p className="font-body-ui text-body-ui text-error">{error}</p>}
          <article className="flex flex-col gap-sm">
            {renderBlocks(tokens, artifact.citations ?? [], docs, 'r')}
          </article>
          {(artifact.citations?.length ?? 0) > 0 && (
            <p className="mt-md font-label-caps text-label-caps text-on-surface-variant">
              {artifact.citations!.length} source citation{artifact.citations!.length === 1 ? '' : 's'} ·
              hover a marker to see the source
            </p>
          )}
        </div>
      </div>
    </section>
  );
}