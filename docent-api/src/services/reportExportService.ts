import puppeteer from 'puppeteer';

/** Render Markdown to a standalone, cleanly styled HTML document. */
export function renderReportHtml(content: string, title: string): string {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    line-height: 1.65;
    font-size: 11pt;
    max-width: 65ch;
    margin: 0 auto;
    padding: 0 8mm;
  }
  h1, h2, h3, h4 {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    line-height: 1.25;
    margin: 1.6em 0 0.5em;
    break-after: avoid;
  }
  h1 { font-size: 20pt; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
  h2 { font-size: 15pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25em; }
  h3 { font-size: 12.5pt; }
  h4 { font-size: 11pt; }
  p { margin: 0.6em 0; text-align: justify; hyphens: auto; }
  ul, ol { margin: 0.6em 0; padding-left: 1.4em; }
  li { margin: 0.25em 0; }
  strong { color: #111827; }
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.85em;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    padding: 0 0.25em;
  }
  pre {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.8em;
    overflow-x: auto;
    font-size: 9pt;
  }
  blockquote {
    margin: 0.8em 0;
    padding-left: 1em;
    border-left: 3px solid #d1d5db;
    color: #4b5563;
  }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.4em 0; }
  /* Inline citation markers — subtle, superscript, quiet color. */
  .cite {
    font-size: 0.72em;
    vertical-align: super;
    line-height: 0;
    color: #6b7280;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: nowrap;
  }
  a { color: #4f46e5; text-decoration: none; }
</style>
</head>
<body>
${renderMarkdownToHtml(content)}
</body>
</html>`;
}

/** Convert the stored Markdown body to HTML, styling citation markers. */
function renderMarkdownToHtml(markdown: string): string {
  // Escape each source marker first so the HTML pass can't interpret it, then
  // style them back as subtle superscript citation markers.
  const markers: Array<{ label: string; n: number }> = [];
  const tokenized = markdown.replace(/\[Source\s+(\d+)\]/g, (label, n) => {
    const token = `\u0000CITE${markers.length}\u0000`;
    markers.push({ label, n: Number(n) });
    return token;
  });

  let html = minimalMarkdownToHtml(tokenized);

  for (const m of markers) {
    const token = `\u0000CITE${markers.indexOf(m)}\u0000`;
    html = html.replace(token, `<sup class="cite">[${m.n}]</sup>`);
  }
  return html;
}

/**
 * A tiny, dependency-free Markdown -> HTML converter covering the subset the
 * generated study guides use (headings, paragraphs, lists, emphasis, code,
 * blockquote, horizontal rule, links). Everything else is escaped as text.
 */
function minimalMarkdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const closeList = () => {
    if (!list) return;
    const tag = list.ordered ? 'ol' : 'ul';
    out.push(`<${tag}>`);
    for (const item of list.items) out.push(`<li>${item}</li>`);
    out.push(`</${tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 4);
      const text = inline(heading[2].trim());
      out.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (!list || list.ordered) { closeList(); list = { ordered: false, items: [] }; }
      list.items.push(inline(ul[1]));
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) { closeList(); list = { ordered: true, items: [] }; }
      list.items.push(inline(ol[1]));
      continue;
    }

    const blockquote = line.match(/^\s*&gt;\s?(.*)$/);
    if (blockquote) {
      closeList();
      out.push(`<blockquote>${inline(blockquote[1])}</blockquote>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      out.push('<hr />');
      continue;
    }

    if (line.trim() === '') {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

/** Inline formatting: code spans, bold, italic, links, escapes. */
function inline(text: string): string {
  const escaped = escapeHtml(text);
  let s = escaped;
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print a report to a styled PDF via headless Chromium. */
export async function renderReportPdf(content: string, title: string): Promise<Buffer> {
  const html = renderReportHtml(content, title);
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'report';
}