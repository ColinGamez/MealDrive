/**
 * Run with:  npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAmounts, addItemToList } from '../shoppingUtils';
import { ShoppingItem } from '../../types';

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

describe('mergeAmounts', () => {
  it('keeps existing when incoming is empty', () => {
    assert.equal(mergeAmounts('1 cup', '   '), '1 cup');
    assert.equal(mergeAmounts('1 cup', ''), '1 cup');
  });

  it('takes incoming verbatim when existing is empty/undefined', () => {
    assert.equal(mergeAmounts('', '2 tbsp'), '2 tbsp');
    assert.equal(mergeAmounts(undefined, '2 tbsp'), '2 tbsp');
  });

  it('sums values when units match and both are positive', () => {
    assert.equal(mergeAmounts('1 cup', '2 cup'), '3 cup');
    assert.equal(mergeAmounts('100 g', '250 g'), '350 g');
  });

  it('preserves both amounts when units differ', () => {
    assert.equal(mergeAmounts('1 cup', '2 tbsp'), '1 cup + 2 tbsp');
  });

  it('preserves both when one value is non-numeric', () => {
    // "1 unit" parses to {value:1, unit:'unit'}; "a pinch" parses to {value:0, unit:'pinch'}
    // Different units, so append.
    assert.equal(mergeAmounts('1 unit', 'a pinch'), '1 unit + a pinch');
  });
});

describe('addItemToList', () => {
  it('appends a new item when none match', () => {
    const next = addItemToList([], 'tomato', '2', ids());
    assert.equal(next.length, 1);
    assert.equal(next[0].name, 'tomato');
    assert.equal(next[0].amount, '2');
    assert.equal(next[0].checked, false);
  });

  it('merges into an existing item when the normalized name matches', () => {
    const list: ShoppingItem[] = [{ id: 'a', name: 'Tomato', amount: '1 cup', checked: false }];
    const next = addItemToList(list, 'tomatoes', '2 cup', ids());
    assert.equal(next.length, 1);
    assert.equal(next[0].id, 'a');
    assert.equal(next[0].amount, '3 cup');
  });

  it('returns the same list reference when merge is a no-op', () => {
    const list: ShoppingItem[] = [{ id: 'a', name: 'tomato', amount: '1 cup', checked: false }];
    const next = addItemToList(list, 'TOMATO', '  ', ids());
    assert.equal(next, list, 'expected no new array allocation for no-op merge');
  });

  it('appends amounts when units differ', () => {
    const list: ShoppingItem[] = [{ id: 'a', name: 'flour', amount: '1 cup', checked: false }];
    const next = addItemToList(list, 'flour', '2 tbsp', ids());
    assert.equal(next[0].amount, '1 cup + 2 tbsp');
  });

  it('treats synonyms as duplicates (scallion = green onion)', () => {
    const list: ShoppingItem[] = [{ id: 'a', name: 'scallion', amount: '1', checked: false }];
    const next = addItemToList(list, 'green onion', '2', ids());
    assert.equal(next.length, 1, 'normalizeName should collapse scallion/green onion');
  });
});
