import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  costOfEmbeddings,
  costOfGeneration,
  estimateTokens,
  formatUsd,
} from '../src/services/observability/metrics.js';

test('embedding cost is zero for zero tokens and scales linearly', () => {
  assert.equal(costOfEmbeddings(0), 0);
  const one = costOfEmbeddings(1_000_000);
  assert.ok(one > 0, 'a full million tokens costs more than zero');
  assert.equal(costOfEmbeddings(2_000_000), 2 * one);
});

test('generation cost is the sum of input and output costs', () => {
  const both = costOfGeneration(1_000_000, 1_000_000);
  const inputOnly = costOfGeneration(1_000_000, 0);
  const outputOnly = costOfGeneration(0, 1_000_000);
  assert.ok(Math.abs(both - (inputOnly + outputOnly)) < 1e-9);
  assert.ok(inputOnly > 0 && outputOnly > 0, 'both sides cost something');
});

test('formatUsd renders readable dollar amounts', () => {
  assert.equal(formatUsd(0), '$0.00000');
  assert.equal(formatUsd(0.0002), '$0.00020');
  assert.match(formatUsd(0.123456), /^\$0\.12346$/);
  assert.equal(formatUsd(Number.NaN), '$0.00000');
});

test('estimateTokens is non-zero for real text', () => {
  assert.ok(estimateTokens('hello world how are you') >= 5);
});