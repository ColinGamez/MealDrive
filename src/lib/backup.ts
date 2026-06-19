import { STORAGE_KEYS, STORAGE_PREFIX } from './storage';

export const BACKUP_FORMAT = 'mealdrive-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_CHARACTERS = 5_000_000;

export interface BackupStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MealDriveBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Record<string, unknown>;
}

export interface BackupSummary {
  pantryItems: number;
  recipes: number;
  savedRecipes: number;
  shoppingItems: number;
  mealPlanDays: number;
  notes: number;
}

const STATIC_BACKUP_KEYS = new Set<string>([
  STORAGE_KEYS.darkMode,
  STORAGE_KEYS.userProfile,
  STORAGE_KEYS.userStats,
  STORAGE_KEYS.pantry,
  STORAGE_KEYS.recipes,
  STORAGE_KEYS.recentHistory,
  STORAGE_KEYS.mealPlan,
  STORAGE_KEYS.mealPlanLanguage,
  STORAGE_KEYS.shoppingList,
  STORAGE_KEYS.savedRecipes,
  STORAGE_KEYS.searchHistory,
  STORAGE_KEYS.onboardingDismissed,
  STORAGE_KEYS.language,
  STORAGE_KEYS.notes,
]);

const DYNAMIC_BACKUP_KEY = /^mealdrive:(servings|adjusted):.+$/;
const LANGUAGE_VALUES = new Set(['en', 'ja', 'ko']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBackupStorageKey(key: string): boolean {
  return STATIC_BACKUP_KEYS.has(key) || DYNAMIC_BACKUP_KEY.test(key);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isArrayOf(value: unknown, predicate: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(predicate);
}

function isIngredient(value: unknown): boolean {
  return isRecord(value)
    && isString(value.name)
    && (value.amount === undefined || isString(value.amount));
}

function isPantryItem(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && (value.amount === undefined || isString(value.amount))
    && (value.isLowStock === undefined || typeof value.isLowStock === 'boolean')
    && (value.expiresAt === undefined || (isString(value.expiresAt) && /^\d{4}-\d{2}-\d{2}$/.test(value.expiresAt)))
    && (value.lastUsedAt === undefined || isFiniteNumber(value.lastUsedAt));
}

function isRecipe(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.title)
    && isString(value.description)
    && isArrayOf(value.ingredients, isIngredient)
    && isStringArray(value.instructions)
    && isString(value.preparationTime)
    && ['Easy', 'Medium', 'Hard'].includes(String(value.difficulty))
    && isFiniteNumber(value.calories)
    && isStringArray(value.dietaryTags)
    && isString(value.imagePrompt)
    && isFiniteNumber(value.rating)
    && isFiniteNumber(value.servings)
    && (value.styleNote === undefined || isString(value.styleNote))
    && (value.language === undefined || LANGUAGE_VALUES.has(String(value.language)));
}

function isRecentRecipe(value: unknown): boolean {
  return isRecord(value) && isRecipe(value.recipe) && isFiniteNumber(value.cookedAt);
}

function isDailyPlan(value: unknown): boolean {
  return isRecord(value)
    && isString(value.day)
    && isRecipe(value.breakfast)
    && isRecipe(value.lunch)
    && isRecipe(value.dinner);
}

function isShoppingItem(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isString(value.amount)
    && typeof value.checked === 'boolean';
}

function isRecipeNote(value: unknown): boolean {
  return isRecord(value)
    && isString(value.id)
    && isString(value.recipeId)
    && isString(value.content)
    && isFiniteNumber(value.timestamp)
    && (value.stepIndex === undefined || isFiniteNumber(value.stepIndex));
}

function isUserProfile(value: unknown): boolean {
  return isRecord(value)
    && isString(value.displayName)
    && isString(value.emojiAvatar)
    && LANGUAGE_VALUES.has(String(value.preferredLanguage))
    && isStringArray(value.dietaryPreferences)
    && isStringArray(value.favoriteCuisines)
    && isString(value.cookingStyle);
}

function isUserStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const required = [
    'totalCooked',
    'weeklyCooked',
    'streak',
    'longestStreak',
    'scansCompleted',
    'rescueCount',
    'mealPlansCreated',
    'shoppingListUses',
  ];
  return required.every((key) => isFiniteNumber(value[key]))
    && (value.lastCookedAt === undefined || isFiniteNumber(value.lastCookedAt));
}

function getManagedKeys(storage: BackupStorage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isBackupStorageKey(key)) keys.push(key);
  }
  return keys.sort();
}

function validateValue(key: string, value: unknown): boolean {
  if (key === STORAGE_KEYS.pantry) return isArrayOf(value, isPantryItem);
  if (key === STORAGE_KEYS.recipes) return isArrayOf(value, isRecipe);
  if (key === STORAGE_KEYS.recentHistory) return isArrayOf(value, isRecentRecipe);
  if (key === STORAGE_KEYS.mealPlan) return isArrayOf(value, isDailyPlan);
  if (key === STORAGE_KEYS.shoppingList) return isArrayOf(value, isShoppingItem);
  if (key === STORAGE_KEYS.savedRecipes || key === STORAGE_KEYS.searchHistory) {
    return isStringArray(value);
  }
  if (key === STORAGE_KEYS.notes) return isArrayOf(value, isRecipeNote);
  if (key === STORAGE_KEYS.darkMode || key === STORAGE_KEYS.onboardingDismissed) {
    return typeof value === 'boolean';
  }
  if (key === STORAGE_KEYS.language) return LANGUAGE_VALUES.has(String(value));
  if (key === STORAGE_KEYS.mealPlanLanguage) {
    return value === null || LANGUAGE_VALUES.has(String(value));
  }
  if (key === STORAGE_KEYS.userProfile) return isUserProfile(value);
  if (key === STORAGE_KEYS.userStats) return isUserStats(value);
  if (key.startsWith(`${STORAGE_PREFIX}servings:`)) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }
  if (key.startsWith(`${STORAGE_PREFIX}adjusted:`)) {
    return isRecord(value) && Object.values(value).every(isString);
  }
  return false;
}

function assertValidBackup(value: unknown): asserts value is MealDriveBackup {
  if (!isRecord(value)) throw new Error('Backup must be a JSON object.');
  if (value.format !== BACKUP_FORMAT) throw new Error('Unsupported backup format.');
  if (value.version !== BACKUP_VERSION) throw new Error('Unsupported backup version.');
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('Backup date is invalid.');
  }
  if (!isRecord(value.data)) throw new Error('Backup data is invalid.');

  for (const [key, entry] of Object.entries(value.data)) {
    if (!isBackupStorageKey(key)) throw new Error(`Unknown backup key: ${key}`);
    if (!validateValue(key, entry)) throw new Error(`Invalid backup value: ${key}`);
  }
}

export function createMealDriveBackup(
  storage: BackupStorage,
  now: Date = new Date(),
): MealDriveBackup {
  const data: Record<string, unknown> = {};

  for (const key of getManagedKeys(storage)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      const value: unknown = JSON.parse(raw);
      if (validateValue(key, value)) data[key] = value;
    } catch {
      // Corrupt values are already ignored by the app, so do not preserve them.
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

export function serializeMealDriveBackup(backup: MealDriveBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseMealDriveBackup(raw: string): MealDriveBackup {
  if (raw.length > MAX_BACKUP_CHARACTERS) throw new Error('Backup is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup is not valid JSON.');
  }
  assertValidBackup(parsed);
  return parsed;
}

function arrayLength(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return Array.isArray(value) ? value.length : 0;
}

export function summarizeMealDriveBackup(backup: MealDriveBackup): BackupSummary {
  return {
    pantryItems: arrayLength(backup.data, STORAGE_KEYS.pantry),
    recipes: arrayLength(backup.data, STORAGE_KEYS.recipes),
    savedRecipes: arrayLength(backup.data, STORAGE_KEYS.savedRecipes),
    shoppingItems: arrayLength(backup.data, STORAGE_KEYS.shoppingList),
    mealPlanDays: arrayLength(backup.data, STORAGE_KEYS.mealPlan),
    notes: arrayLength(backup.data, STORAGE_KEYS.notes),
  };
}

/**
 * Replace MealDrive-owned storage as one best-effort transaction. If any write
 * fails, the previous snapshot is restored before the error is surfaced.
 */
export function restoreMealDriveBackup(
  backup: MealDriveBackup,
  storage: BackupStorage,
): void {
  assertValidBackup(backup);
  const previous = new Map<string, string>();
  const previousKeys = getManagedKeys(storage);

  for (const key of previousKeys) {
    const value = storage.getItem(key);
    if (value !== null) previous.set(key, value);
  }

  try {
    previousKeys.forEach((key) => storage.removeItem(key));
    for (const [key, value] of Object.entries(backup.data)) {
      storage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    getManagedKeys(storage).forEach((key) => storage.removeItem(key));
    previous.forEach((value, key) => storage.setItem(key, value));
    throw error;
  }
}
