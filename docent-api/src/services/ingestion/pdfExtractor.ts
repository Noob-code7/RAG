import { extractText, getDocumentProxy } from 'unpdf';
import type { PageText } from '../../types.js';

/**
 * Extract text page-by-page from a PDF buffer using `unpdf` (a maintained
 * pdf.js wrapper). Returns one entry per page in reading order; text is keyed
 * to its page number so chunk attribution stays accurate.
 */
export async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, i) => ({ pageNumber: i + 1, text: pageText ?? '' }));
}

/**
 * True when the extracted text is dense enough to be a real text layer.
 * A scanned or image-only PDF yields near-zero characters, so we treat any
 * document whose average is below `minCharsPerPage` as having no extractable
 * text and fail it explicitly rather than indexing nothing silently.
 */
export function hasExtractableText(pages: PageText[], minCharsPerPage: number): boolean {
  if (pages.length === 0) return false;
  const totalChars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
  return totalChars / pages.length >= minCharsPerPage;
}