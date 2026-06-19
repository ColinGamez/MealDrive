/**
 * Run with:  npm test
 *
 * These are pure unit tests for the safeJsonParse helper. They don't touch
 * localStorage so they run cleanly in plain node (no jsdom needed).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse } from '../storage';

describe('safeJsonParse', () => {
  it('returns the fallback for null', () => {
    assert.deepEqual(safeJsonParse<number[]>(null, [1, 2]), [1, 2]);
  });

  it('returns the fallback for malformed JSON', () => {
    assert.deepEqual(safeJsonParse<{ a: number }>('{not json', { a: 1 }), { a: 1 });
  });

  it('parses well-formed JSON', () => {
    assert.deepEqual(safeJsonParse<{ a: number }>('{"a":42}', { a: 0 }), { a: 42 });
  });

  it('round-trips arrays', () => {
    assert.deepEqual(safeJsonParse<number[]>('[1,2,3]', []), [1, 2, 3]);
  });
});
