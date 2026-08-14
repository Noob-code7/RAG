import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExtractableText } from '../src/services/ingestion/pdfExtractor.js';

const MIN = 20;

test('dense multi-page text is treated as extractable', () => {
  const pages = [
    { pageNumber: 1, text: 'This page has plenty of real prose to extract.'.repeat(5) },
    { pageNumber: 2, text: 'More meaningful content on the second page.'.repeat(5) },
  ];
  assert.equal(hasExtractableText(pages, MIN), true);
});

test('scanned / image-only pages are flagged as not extractable', () => {
  const pages = [
    { pageNumber: 1, text: '' },
    { pageNumber: 2, text: ' ' },
    { pageNumber: 3, text: '\n' },
  ];
  assert.equal(hasExtractableText(pages, MIN), false);
});

test('a lone page with almost no text is flagged', () => {
  const pages = [{ pageNumber: 1, text: 'few' }];
  assert.equal(hasExtractableText(pages, MIN), false);
});

test('a short but genuinely text-bearing document passes', () => {
  const pages = [{ pageNumber: 1, text: 'Chapter 1 — Introduction to Data Structures'.repeat(3) }];
  assert.equal(hasExtractableText(pages, 20), true);
});

test('zero pages is never extractable', () => {
  assert.equal(hasExtractableText([], MIN), false);
});
