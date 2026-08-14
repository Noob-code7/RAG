import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'gpt-tokenizer';
import { chunkPages, chunkUnits, splitIntoUnits } from '../src/services/ingestion/chunker.js';

function tokens(text: string): number {
  return encode(text).length;
}

// Word-level overlap: chunk N+1 begins with the trailing words of chunk N.
// (Token-level comparison is brittle here because BPE token boundaries shift
// with the leading-space context, not because overlap is missing.)
function overlapWordCount(a: string, b: string): number {
  const wordsA = a.trim().split(/\s+/);
  const wordsB = b.trim().split(/\s+/);
  const maxLen = Math.min(wordsA.length, wordsB.length);
  for (let len = maxLen; len >= 1; len--) {
    let matches = true;
    for (let j = 0; j < len; j++) {
      if (wordsA[wordsA.length - len + j] !== wordsB[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return len;
  }
  return 0;
}

test('chunkUnits keeps every chunk near the token budget', () => {
  const units = Array.from({ length: 200 }, (_, i) => ({ text: `filler word ${i}`, page: 1 }));
  const chunks = chunkUnits(units, 50, 10);
  assert.ok(chunks.length > 5, 'long input should produce multiple chunks');
  for (const c of chunks) {
    assert.ok(c.tokenCount <= 50 + 10, `chunk over budget: ${c.tokenCount}`);
    assert.ok(c.content.length > 0);
  }
});

test('consecutive chunks overlap by roughly the requested window', () => {
  const units = Array.from({ length: 200 }, (_, i) => ({ text: `filler word ${i}`, page: 1 }));
  const chunks = chunkUnits(units, 50, 10);
  for (let i = 1; i < chunks.length; i++) {
    const overlap = overlapWordCount(chunks[i - 1].content, chunks[i].content);
    assert.ok(overlap >= 2, `chunks ${i - 1} and ${i} share no overlap`);
    assert.ok(overlap <= 12, `chunks ${i - 1} and ${i} overlap too much: ${overlap}`);
  }
});

test('a fact sitting on a chunk boundary is preserved by the overlap', () => {
  const filler = Array.from({ length: 40 }, (_, i) => `padding word number ${i}`);
  const fact = 'MARKER_FACT retrievable across the boundary.';
  const units = [...filler, fact, ...filler].map((text) => ({ text, page: 1 }));
  const chunks = chunkUnits(units, 8, 3);
  const occurrences = chunks.filter((c) => c.content.includes('MARKER_FACT')).length;
  assert.ok(occurrences >= 2, `boundary fact should appear in 2+ chunks, got ${occurrences}`);
});

test('chunkPages attributes page numbers per chunk', () => {
  const page1 = Array.from({ length: 60 }, (_, i) => `page one sentence ${i}.`).join(' ');
  const page2 = Array.from({ length: 60 }, (_, i) => `page two sentence ${i}.`).join(' ');
  const chunks = chunkPages([page1, page2], 60, 10);
  assert.ok(chunks.some((c) => c.pageNumber === 1), 'no chunk attributed to page 1');
  assert.ok(chunks.some((c) => c.pageNumber === 2), 'no chunk attributed to page 2');
  for (const c of chunks) {
    assert.ok(c.pageNumber === 1 || c.pageNumber === 2);
  }
});

test('splitIntoUnits leaves small text intact and respects the budget', () => {
  const short = 'A single short sentence.';
  assert.deepEqual(splitIntoUnits(short), [short]);

  const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
  const units = splitIntoUnits(long, 300);
  assert.ok(units.length > 1, 'oversized text must be split');
  for (const u of units) {
    assert.ok(tokens(u) <= 300, `unit over budget: ${tokens(u)}`);
  }
});

test('empty and whitespace-only pages produce no chunks', () => {
  const chunks = chunkPages(['', '   ', 'hello world'], 50, 10);
  assert.ok(chunks.length >= 1);
  assert.ok(chunks.every((c) => c.content.length > 0));
});
