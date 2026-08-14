import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCitedLabels } from '../src/services/generation/promptBuilder.js';
import { deriveConfidence } from '../src/services/retrieval/rerank.js';

const LOW = 0.25;
const HIGH = 0.4;

test('extractCitedLabels finds inline and labelled source citations', () => {
  const answer =
    'The chunk size is 500 tokens [Source 1]. The overlap [Source 2, page 3] prevents fact loss [Source 1][Source 2].';
  assert.deepEqual(extractCitedLabels(answer), [1, 2]);
});

test('extractCitedLabels ignores text without citations', () => {
  assert.deepEqual(extractCitedLabels('No sources cited here.'), []);
  assert.deepEqual(extractCitedLabels('[] and Source1 and (Source 9) and [Source x]'), []);
});

test('deriveConfidence maps similarity bands and citation presence', () => {
  assert.equal(deriveConfidence(0.1, 0, LOW, HIGH), 'not_found'); // below low band
  assert.equal(deriveConfidence(0.3, 0, LOW, HIGH), 'not_found'); // weak match, nothing cited
  assert.equal(deriveConfidence(0.3, 2, LOW, HIGH), 'partial'); // weak match but cited
  assert.equal(deriveConfidence(0.55, 0, LOW, HIGH), 'partial'); // strong match, nothing cited
  assert.equal(deriveConfidence(0.55, 1, LOW, HIGH), 'grounded'); // strong match + citation
});