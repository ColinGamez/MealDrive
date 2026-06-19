import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Single namespace for every key MealDrive writes to localStorage.
 * Use the helpers below; never call localStorage.getItem/setItem directly
 * with a bare string key.
 */
export const STORAGE_PREFIX = 'mealdrive:';

export const STORAGE_KEYS = {
  darkMode: `${STORAGE_PREFIX}darkMode`,
  userProfile: `${STORAGE_PREFIX}userProfile`,
  userStats: `${STORAGE_PREFIX}userStats`,
  pantry: `${STORAGE_PREFIX}pantry`,
  recipes: `${STORAGE_PREFIX}recipes`,
  recentHistory: `${STORAGE_PREFIX}recentHistory`,
  mealPlan: `${STORAGE_PREFIX}mealPlan`,
  mealPlanLanguage: `${STORAGE_PREFIX}mealPlanLanguage`,
  shoppingList: `${STORAGE_PREFIX}shoppingList`,
  savedRecipes: `${STORAGE_PREFIX}savedRecipes`,
  searchHistory: `${STORAGE_PREFIX}searchHistory`,
  onboardingDismissed: `${STORAGE_PREFIX}onboardingDismissed`,
  language: `${STORAGE_PREFIX}lang`,
  notes: `${STORAGE_PREFIX}recipeNotes`,
  schemaVersion: `${STORAGE_PREFIX}schemaVersion`,
  servings: (recipeId: string) => `${STORAGE_PREFIX}servings:${recipeId}`,
  adjustedAmounts: (recipeId: string) => `${STORAGE_PREFIX}adjusted:${recipeId}`,
} as const;

const CURRENT_SCHEMA_VERSION = 1;

/** Legacy key → new key. Used by migrateLegacyStorage(). */
const LEGACY_KEY_MAP: Record<string, string> = {
  darkMode: STORAGE_KEYS.darkMode,
  userProfile: STORAGE_KEYS.userProfile,
  userStats: STORAGE_KEYS.userStats,
  pantry: STORAGE_KEYS.pantry,
  recipes: STORAGE_KEYS.recipes,
  recentHistory: STORAGE_KEYS.recentHistory,
  mealPlan: STORAGE_KEYS.mealPlan,
  shoppingList: STORAGE_KEYS.shoppingList,
  savedRecipes: STORAGE_KEYS.savedRecipes,
  searchHistory: STORAGE_KEYS.searchHistory,
  onboardingDismissed: STORAGE_KEYS.onboardingDismissed,
  mealDrive_lang: STORAGE_KEYS.language,
  mealDrive_recipe_notes: STORAGE_KEYS.notes,
};

/** Per-recipe legacy keys: `servings_<id>` and `adjustedAmounts_<id>`. */
const LEGACY_RECIPE_KEY_PATTERNS: Array<{ regex: RegExp; build: (id: string) => string }> = [
  { regex: /^servings_(.+)$/, build: (id) => STORAGE_KEYS.servings(id) },
  { regex: /^adjustedAmounts_(.+)$/, build: (id) => STORAGE_KEYS.adjustedAmounts(id) },
];

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = `${STORAGE_PREFIX}__probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a JSON string and never throw. Returns `fallback` on any error
 * (corrupt JSON, type mismatch, missing key).
 */
export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Read + parse a key, returning `fallback` on missing/corrupt data. */
export function readStorage<T>(key: string, fallback: T): T {
  if (!isStorageAvailable()) return fallback;
  try {
    return safeJsonParse(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

/** Write a value to localStorage, swallowing quota/security errors. */
export function writeStorage(key: string, value: unknown): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // Quota exceeded, private mode, etc. Log and continue.
    if (typeof console !== 'undefined') {
      console.warn(`[storage] failed to write ${key}`, err);
    }
    return false;
  }
}

export function removeStorage(key: string): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/**
 * One-time migration from the un-namespaced keys MealDrive used in earlier
 * versions to the `mealdrive:*` namespace. Idempotent: safe to call on every
 * app start. Tracks completion via STORAGE_KEYS.schemaVersion.
 */
export function migrateLegacyStorage(): void {
  if (!isStorageAvailable()) return;

  try {
    const versionRaw = window.localStorage.getItem(STORAGE_KEYS.schemaVersion);
    const currentVersion = versionRaw ? Number(versionRaw) : 0;
    if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

    // 1. Migrate flat keys.
    for (const [legacyKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
      const value = window.localStorage.getItem(legacyKey);
      if (value !== null) {
        // Only copy if the new slot doesn't already have data.
        if (window.localStorage.getItem(newKey) === null) {
          window.localStorage.setItem(newKey, value);
        }
        window.localStorage.removeItem(legacyKey);
      }
    }

    // 2. Migrate per-recipe keys (servings_<id>, adjustedAmounts_<id>).
    const legacyPerRecipeKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(STORAGE_PREFIX)) continue;
      for (const { regex, build } of LEGACY_RECIPE_KEY_PATTERNS) {
        const match = k.match(regex);
        if (match) {
          const newKey = build(match[1]);
          const value = window.localStorage.getItem(k);
          if (value !== null && window.localStorage.getItem(newKey) === null) {
            window.localStorage.setItem(newKey, value);
          }
          legacyPerRecipeKeys.push(k);
          break;
        }
      }
    }
    legacyPerRecipeKeys.forEach((k) => window.localStorage.removeItem(k));

    // 3. Stamp version.
    window.localStorage.setItem(STORAGE_KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[storage] migration failed', err);
    }
  }
}

/**
 * useState backed by localStorage with safe parsing and quota-aware writes.
 * The fallback is used if the key is missing OR corrupt.
 *
 * The fallback can be a value or a function (lazy-initialized).
 */
export function useLocalStorageState<T>(
  key: string,
  fallback: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const initial =
      typeof fallback === 'function' ? (fallback as () => T)() : fallback;
    return readStorage<T>(key, initial);
  });

  // Track last-written value to skip redundant writes.
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      if (serialized !== lastWrittenRef.current) {
        if (writeStorage(key, state)) {
          lastWrittenRef.current = serialized;
        }
      }
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn(`[storage] failed to serialize ${key}`, err);
      }
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Returns a setter that writes to localStorage but doesn't subscribe the
 * component to changes. Useful for write-only one-shot values.
 */
export function useStorageWriter() {
  return useCallback((key: string, value: unknown) => writeStorage(key, value), []);
}
