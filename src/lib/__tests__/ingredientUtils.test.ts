import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuantity,
  formatQuantity,
  normalizeName,
  checkIngredient,
  deductIngredients,
  getRecipePantryStatus,
} from '../ingredientUtils';
import { Recipe, PantryItem } from '../../types';

describe('parseQuantity', () => {
  it('parses integer + unit', () => {
    assert.deepEqual(parseQuantity('3 cups'), { value: 3, unit: 'cup' });
  });

  it('parses decimal + unit', () => {
    assert.deepEqual(parseQuantity('1.5 tsp'), { value: 1.5, unit: 'tsp' });
  });

  it('parses simple fractions', () => {
    const result = parseQuantity('1/2 cup');
    assert.equal(result.unit, 'cup');
    assert.ok(Math.abs(result.value - 0.5) < 0.001);
  });

  it('parses mixed numbers', () => {
    const result = parseQuantity('1 1/2 cups');
    assert.equal(result.unit, 'cup');
    assert.ok(Math.abs(result.value - 1.5) < 0.001);
  });

  it('handles unit-only strings', () => {
    assert.deepEqual(parseQuantity('a pinch'), { value: 0, unit: 'a pinch' });
  });

  it('returns 0/empty for empty input', () => {
    assert.deepEqual(parseQuantity(''), { value: 0, unit: '' });
  });

  it('normalizes tablespoon and teaspoon variations', () => {
    assert.equal(parseQuantity('2 tablespoons').unit, 'tbsp');
    assert.equal(parseQuantity('3 teaspoons').unit, 'tsp');
  });
});

describe('formatQuantity', () => {
  it('formats whole numbers with units', () => {
    assert.equal(formatQuantity(3, 'cup'), '3 cup');
  });

  it('formats common fractions', () => {
    assert.equal(formatQuantity(0.5, 'tsp'), '1/2 tsp');
    assert.equal(formatQuantity(0.25, 'cup'), '1/4 cup');
    assert.equal(formatQuantity(0.75, 'tbsp'), '3/4 tbsp');
  });

  it('formats mixed numbers', () => {
    assert.equal(formatQuantity(1.5, 'cup'), '1 1/2 cup');
  });

  it('returns 0 for non-positive values', () => {
    assert.equal(formatQuantity(0, 'g'), '0 g');
    assert.equal(formatQuantity(-1, 'g'), '0 g');
  });
});

describe('normalizeName', () => {
  it('lowercases', () => {
    assert.equal(normalizeName('TOMATO'), 'tomato');
  });

  it('singularizes "tomatoes" correctly (not "tomatoe")', () => {
    assert.equal(normalizeName('tomatoes'), 'tomato');
  });

  it('singularizes "potatoes" correctly', () => {
    assert.equal(normalizeName('potatoes'), 'potato');
  });

  it('singularizes "berries" → "berry"', () => {
    assert.equal(normalizeName('berries'), 'berry');
  });

  it('singularizes "leaves" → "leaf"', () => {
    assert.equal(normalizeName('leaves'), 'leaf');
  });

  it('keeps "cheese" unchanged', () => {
    assert.equal(normalizeName('cheese'), 'cheese');
  });

  it('keeps "ss"-ending words unchanged', () => {
    assert.equal(normalizeName('grass'), 'grass');
  });

  it('strips stop words', () => {
    assert.equal(normalizeName('fresh organic spinach'), 'spinach');
  });

  it('applies synonyms (scallion → green onion)', () => {
    assert.equal(normalizeName('scallions'), 'green onion');
  });
});

describe('getRecipePantryStatus', () => {
  const baseRecipe: Recipe = {
    id: 'r1',
    title: 'Test',
    description: 'desc',
    ingredients: [
      { name: 'eggs', amount: '2' },
      { name: 'flour', amount: '1 cup' },
    ],
    instructions: ['step 1'],
    preparationTime: '10 mins',
    difficulty: 'Easy',
    calories: 100,
    dietaryTags: [],
    imagePrompt: '',
    rating: 4,
    servings: 1,
  };

  it('flags isCanMakeNow when pantry has everything', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'eggs', amount: '4' },
      { id: 'b', name: 'flour', amount: '2 cups' },
    ];
    const status = getRecipePantryStatus(baseRecipe, pantry);
    assert.equal(status.isCanMakeNow, true);
    assert.equal(status.rescueMessage, null);
  });

  it('flags isAlmostThere when one ingredient is missing', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'eggs', amount: '4' },
    ];
    const status = getRecipePantryStatus(baseRecipe, pantry);
    assert.equal(status.isAlmostThere, true);
    assert.equal(status.missingCount, 1);
    assert.notEqual(status.rescueMessage, null);
    assert.equal(status.rescueMessage?.key, 'rescue.awaySingle');
  });

  it('returns rescue message as i18n key+params (not hardcoded English)', () => {
    const pantry: PantryItem[] = [];
    const status = getRecipePantryStatus(baseRecipe, pantry);
    if (status.rescueMessage) {
      assert.ok(status.rescueMessage.key.startsWith('rescue.'));
    }
  });
});

describe('checkIngredient', () => {
  it('does NOT include id field for unmatched ingredients (stable React keys)', () => {
    const check = checkIngredient(
      { name: 'saffron', amount: '1 tsp' },
      [],
    );
    // Per the new contract, no `pantryId` when there's no pantry match.
    assert.equal(check.pantryId, undefined);
    assert.equal(check.status, 'missing');
  });

  it('uses pantry id when matched', () => {
    const pantry: PantryItem[] = [{ id: 'pantry-uuid', name: 'eggs', amount: '4' }];
    const check = checkIngredient({ name: 'eggs', amount: '2' }, pantry);
    assert.equal(check.pantryId, 'pantry-uuid');
    assert.equal(check.status, 'available');
  });

  it('marks partial when pantry has less than recipe needs', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'flour', amount: '1 cup' }];
    const check = checkIngredient({ name: 'flour', amount: '2 cups' }, pantry);
    assert.equal(check.status, 'partial');
    assert.match(check.missingAmount || '', /1\s*cup/);
  });
});

describe('deductIngredients', () => {
  it('subtracts a single ingredient', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'flour', amount: '2 cups' }];
    const result = deductIngredients([{ name: 'flour', amount: '1 cup' }], pantry);
    assert.equal(result.deductions.length, 1);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.updatedPantry[0].amount, '1 cup');
  });

  it('removes a pantry item that gets used up', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'eggs', amount: '2' }];
    const result = deductIngredients([{ name: 'eggs', amount: '2' }], pantry);
    assert.equal(result.updatedPantry.length, 0);
  });

  it('skips when units are incompatible', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'milk', amount: '1 cup' }];
    const result = deductIngredients([{ name: 'milk', amount: '500 ml' }], pantry);
    assert.equal(result.deductions.length, 0);
    assert.equal(result.skipped[0]?.reason, 'incompatible_units');
  });

  it('skips when pantry is missing the ingredient', () => {
    const result = deductIngredients([{ name: 'kelp', amount: '1' }], []);
    assert.equal(result.skipped[0]?.reason, 'missing');
  });

  it('groups duplicate recipe ingredients before subtracting', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'butter', amount: '4 tbsp' }];
    const result = deductIngredients(
      [
        { name: 'butter', amount: '2 tbsp' },
        { name: 'butter', amount: '1 tbsp' },
      ],
      pantry,
    );
    assert.equal(result.deductions.length, 1);
    assert.equal(result.updatedPantry[0].amount, '1 tbsp');
  });
});
