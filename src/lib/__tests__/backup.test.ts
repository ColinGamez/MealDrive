import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupStorage,
  MealDriveBackup,
  createMealDriveBackup,
  parseMealDriveBackup,
  restoreMealDriveBackup,
  summarizeMealDriveBackup,
} from '../backup';
import { STORAGE_KEYS } from '../storage';

class MemoryStorage implements BackupStorage {
  private readonly values = new Map<string, string>();
  failNextWriteFor: string | null = null;

  constructor(entries: Array<[string, string]> = []) {
    entries.forEach(([key, value]) => this.values.set(key, value));
  }

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failNextWriteFor === key) {
      this.failNextWriteFor = null;
      throw new Error('quota exceeded');
    }
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const validBackup = (data: Record<string, unknown>): MealDriveBackup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: '2026-06-20T00:00:00.000Z',
  data,
});

const validRecipe = (id: string) => ({
  id,
  title: 'Omelette',
  description: 'A simple omelette.',
  ingredients: [{ name: 'Eggs', amount: '2' }],
  instructions: ['Whisk and cook.'],
  preparationTime: '10 minutes',
  difficulty: 'Easy',
  calories: 250,
  dietaryTags: ['Vegetarian'],
  imagePrompt: 'An omelette on a plate',
  rating: 4.5,
  servings: 1,
});

const validPantryItem = (id: string) => ({ id, name: `Ingredient ${id}` });
const validShoppingItem = (id: string) => ({
  id,
  name: `Item ${id}`,
  amount: '1',
  checked: false,
});
const validNote = (id: string) => ({
  id,
  recipeId: 'recipe-1',
  content: `Note ${id}`,
  timestamp: 1_781_913_600_000,
});
const validPlanDay = (day: string) => ({
  day,
  breakfast: validRecipe(`${day}-breakfast`),
  lunch: validRecipe(`${day}-lunch`),
  dinner: validRecipe(`${day}-dinner`),
});

describe('MealDrive backups', () => {
  it('exports only valid MealDrive-owned data', () => {
    const storage = new MemoryStorage([
      [STORAGE_KEYS.pantry, JSON.stringify([{ id: '1', name: 'Milk' }])],
      [STORAGE_KEYS.servings('recipe-1'), '4'],
      [STORAGE_KEYS.recipes, '{broken'],
      [STORAGE_KEYS.schemaVersion, '1'],
      ['other-app:data', JSON.stringify({ private: true })],
    ]);

    const backup = createMealDriveBackup(storage, new Date('2026-06-20T00:00:00.000Z'));

    assert.deepEqual(backup.data, {
      [STORAGE_KEYS.pantry]: [{ id: '1', name: 'Milk' }],
      [STORAGE_KEYS.servings('recipe-1')]: 4,
    });
    assert.equal(backup.exportedAt, '2026-06-20T00:00:00.000Z');
  });

  it('parses a valid backup and summarizes user-visible counts', () => {
    const backup = parseMealDriveBackup(JSON.stringify(validBackup({
      [STORAGE_KEYS.pantry]: [validPantryItem('1'), validPantryItem('2')],
      [STORAGE_KEYS.recipes]: [validRecipe('r1')],
      [STORAGE_KEYS.savedRecipes]: ['r1'],
      [STORAGE_KEYS.shoppingList]: [validShoppingItem('1'), validShoppingItem('2'), validShoppingItem('3')],
      [STORAGE_KEYS.mealPlan]: Array.from({ length: 7 }, (_, index) => validPlanDay(`Day ${index + 1}`)),
      [STORAGE_KEYS.notes]: [validNote('1'), validNote('2')],
    })));

    assert.deepEqual(summarizeMealDriveBackup(backup), {
      pantryItems: 2,
      recipes: 1,
      savedRecipes: 1,
      shoppingItems: 3,
      mealPlanDays: 7,
      notes: 2,
    });
  });

  it('rejects malformed JSON, unknown keys, versions, and invalid values', () => {
    assert.throws(() => parseMealDriveBackup('{nope'));
    assert.throws(() => parseMealDriveBackup(JSON.stringify({
      ...validBackup({}),
      version: 99,
    })));
    assert.throws(() => parseMealDriveBackup(JSON.stringify(validBackup({
      'other-app:data': [],
    }))));
    assert.throws(() => parseMealDriveBackup(JSON.stringify(validBackup({
      [STORAGE_KEYS.pantry]: 'not-an-array',
    }))));
    assert.throws(() => parseMealDriveBackup(JSON.stringify(validBackup({
      [STORAGE_KEYS.recipes]: [{ id: 'incomplete' }],
    }))));
  });

  it('replaces managed data while preserving unrelated and schema keys', () => {
    const storage = new MemoryStorage([
      [STORAGE_KEYS.pantry, JSON.stringify([{ id: 'old' }])],
      [STORAGE_KEYS.recipes, JSON.stringify([{ id: 'old-recipe' }])],
      [STORAGE_KEYS.schemaVersion, '1'],
      ['other-app:data', 'keep-me'],
    ]);

    restoreMealDriveBackup(validBackup({
      [STORAGE_KEYS.pantry]: [validPantryItem('new')],
    }), storage);

    assert.equal(storage.getItem(STORAGE_KEYS.pantry), JSON.stringify([validPantryItem('new')]));
    assert.equal(storage.getItem(STORAGE_KEYS.recipes), null);
    assert.equal(storage.getItem(STORAGE_KEYS.schemaVersion), '1');
    assert.equal(storage.getItem('other-app:data'), 'keep-me');
  });

  it('rolls back the original snapshot when a restore write fails', () => {
    const originalPantry = JSON.stringify([{ id: 'original' }]);
    const storage = new MemoryStorage([
      [STORAGE_KEYS.pantry, originalPantry],
      [STORAGE_KEYS.recipes, JSON.stringify([{ id: 'original-recipe' }])],
    ]);
    storage.failNextWriteFor = STORAGE_KEYS.recipes;

    assert.throws(() => restoreMealDriveBackup(validBackup({
      [STORAGE_KEYS.pantry]: [validPantryItem('new')],
      [STORAGE_KEYS.recipes]: [validRecipe('new-recipe')],
    }), storage));

    assert.equal(storage.getItem(STORAGE_KEYS.pantry), originalPantry);
    assert.equal(storage.getItem(STORAGE_KEYS.recipes), JSON.stringify([{ id: 'original-recipe' }]));
  });
});
