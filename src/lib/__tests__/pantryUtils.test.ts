import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PantryItem } from '../../types';
import {
  getPantryFreshness,
  getPantryGenerationContext,
  mergePantryItems,
  prioritizePantryItems,
} from '../pantryUtils';

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

describe('pantry freshness', () => {
  const now = new Date('2026-06-20T12:00:00').getTime();

  it('classifies expired, use-soon, fresh, and undated items', () => {
    assert.deepEqual(getPantryFreshness({ expiresAt: '2026-06-19' }, now), {
      status: 'expired',
      daysRemaining: -1,
    });
    assert.deepEqual(getPantryFreshness({ expiresAt: '2026-06-22' }, now), {
      status: 'useSoon',
      daysRemaining: 2,
    });
    assert.deepEqual(getPantryFreshness({ expiresAt: '2026-07-01' }, now), {
      status: 'fresh',
      daysRemaining: 11,
    });
    assert.deepEqual(getPantryFreshness({}, now), {
      status: 'none',
      daysRemaining: null,
    });
  });

  it('prioritizes expired and use-soon ingredients without mutating input', () => {
    const items: PantryItem[] = [
      { id: 'undated', name: 'Rice' },
      { id: 'fresh', name: 'Carrots', expiresAt: '2026-07-01' },
      { id: 'soon', name: 'Milk', expiresAt: '2026-06-21' },
      { id: 'expired', name: 'Spinach', expiresAt: '2026-06-19' },
    ];

    const prioritized = prioritizePantryItems(items, now);
    assert.deepEqual(prioritized.map((item) => item.id), [
      'expired',
      'soon',
      'fresh',
      'undated',
    ]);
    assert.deepEqual(items.map((item) => item.id), ['undated', 'fresh', 'soon', 'expired']);
  });

  it('prioritizes use-soon food and excludes expired food from AI context', () => {
    const context = getPantryGenerationContext([
      { id: 'rice', name: 'Rice' },
      { id: 'milk', name: 'Milk', expiresAt: '2026-06-21' },
      { id: 'spinach', name: 'Spinach', expiresAt: '2026-06-19' },
    ], now);

    assert.deepEqual(context, {
      ingredients: ['Milk', 'Rice'],
      priorityIngredients: ['Milk'],
    });
  });
});
