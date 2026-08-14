import { encode } from 'gpt-tokenizer';
import type { Chunk } from '../../types.js';

export interface Unit {
  text: string;
  page: number;
}

// Separation levels, most meaningful first. A piece of text is only split with a
// given separator when it is still over budget, so paragraphs survive intact and
// only oversized blocks get carved up — this is the "recursive" part.
const SEPARATORS = ['\n\n', '\n', '. ', '。', '! ', '？', '? ', '; ', '，'];

const tokensOf = (text: string): number => encode(text).length;

export function splitIntoUnits(text: string, maxUnitTokens = 300): string[] {
  return splitRecursively(text, SEPARATORS, maxUnitTokens).filter((p) => p.trim().length > 0);
}

function splitRecursively(text: string, separators: string[], maxUnitTokens: number): string[] {
  let pieces = [text];
  for (const sep of separators) {
    const next: string[] = [];
    for (const piece of pieces) {
      if (tokensOf(piece) <= maxUnitTokens) {
        next.push(piece);
      } else {
        const parts = piece.split(sep);
        if (parts.length === 1) {
          // Separator absent here; leave for the next, finer-grained level.
          next.push(piece);
        } else {
          next.push(...parts);
        }
      }
    }
    pieces = next;
  }
  // Last resort: word-level grouping for anything still over budget.
  const result: string[] = [];
  for (const piece of pieces) {
    if (tokensOf(piece) <= maxUnitTokens) {
      result.push(piece);
    } else {
      result.push(...splitByWords(piece, maxUnitTokens));
    }
  }
  return result.filter((p) => p.trim().length > 0);
}

function splitByWords(text: string, maxUnitTokens: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const groups: string[] = [];
  let current = '';
  let currentTokens = 0;
  for (const word of words) {
    const t = tokensOf(word);
    if (current && currentTokens + t > maxUnitTokens) {
      groups.push(current);
      current = word;
      currentTokens = t;
    } else {
      current = current ? `${current} ${word}` : word;
      currentTokens += t;
    }
  }
  if (current) groups.push(current);
  return groups;
}

/**
 * Greedily pack units into chunks of at most `maxTokens`, carrying over the tail
 * of each finished chunk into the next.
 *
 * WHY OVERLAP MATTERS: if a sentence (or a single fact) happens to straddle the
 * exact cut point between two chunks, it gets silently split in half — neither
 * chunk then contains the full fact, and its embedding matches nothing, so the
 * fact becomes unretrievable. Re-appending the last `overlapTokens` tokens of a
 * finished chunk to the head of the next chunk guarantees the boundary region
 * appears in BOTH chunks (at slightly different positions), so at least one
 * embedding captures the complete fact regardless of where the cut lands.
 */
export function chunkUnits(units: Unit[], maxTokens: number, overlapTokens: number): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Unit[] = [];
  let currentTokens = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    chunks.push({
      content: current.map((u) => u.text).join(' ').trim(),
      pageNumber: current[0].page,
      chunkIndex: chunks.length,
      tokenCount: currentTokens,
    });
  };

  for (const unit of units) {
    const t = tokensOf(unit.text);
    if (current.length > 0 && currentTokens + t > maxTokens) {
      flush();
      // Seed the next chunk with the overlap tail of the one just flushed.
      const tail: Unit[] = [];
      let tailTokens = 0;
      for (let i = current.length - 1; i >= 0 && tailTokens < overlapTokens; i--) {
        tail.unshift(current[i]);
        tailTokens += tokensOf(current[i].text);
      }
      current = tail;
      currentTokens = tailTokens;
    }
    current.push(unit);
    currentTokens += t;
  }
  flush();
  return chunks;
}

export function chunkPages(pages: string[], maxTokens: number, overlapTokens: number): Chunk[] {
  const units: Unit[] = [];
  pages.forEach((text, i) => {
    for (const piece of splitIntoUnits(text)) {
      units.push({ text: piece, page: i + 1 });
    }
  });
  return chunkUnits(units, maxTokens, overlapTokens);
}