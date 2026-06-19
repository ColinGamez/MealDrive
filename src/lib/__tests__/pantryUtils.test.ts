import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PantryItem } from '../../types';
import { mergePantryItems } from '../pantryUtils';

const existing: PantryItem[] = [
  { id: 'salt', name: 'Salt', amount: '1 jar', isLowStock: true },
];

describe('mergePantryItems', () => {
  it('adds a batch in one immutable result', () => {
    const result = mergePantryItems(existing, [
      { id: 'eggs', name: 'Eggs', amount: '6' },
      { id: 'rice', name: 'Rice', amount: '1 kg' },
    ]);

    assert.equal(result.length, 3);
    assert.deepEqual(result.map((item) => item.name), ['Salt', 'Eggs', 'Rice']);
    assert.notEqual(result, existing);
  });

  it('keeps stable IDs when a matching item is refreshed', () => {
    const result = mergePantryItems(existing, [
      { id: 'replacement', name: 'salt', amount: '2 jars' },
    ]);

    assert.equal(result[0].id, 'salt');
    assert.equal(result[0].amount, '2 jars');
    assert.equal(result[0].isLowStock, false);
  });

  it('deduplicates normalized synonyms', () => {
    const result = mergePantryItems(
      [{ id: 'green-onion', name: 'Green onion' }],
      [{ id: 'scallion', name: 'Scallion' }],
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'green-onion');
  });

  it('returns the same reference when a batch changes nothing', () => {
    const settled = existing.map((item) => ({ ...item, isLowStock: false }));
    const result = mergePantryItems(settled, [
      { id: 'replacement', name: 'salt' },
    ]);

    assert.equal(result, settled);
  });
});
