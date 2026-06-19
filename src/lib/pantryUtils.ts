import { PantryItem } from '../types';
import { normalizeName } from './ingredientUtils';

/**
 * Adds pantry items in one immutable update while preserving stable IDs and
 * collapsing synonyms/duplicate names (for example scallion + green onion).
 */
export function mergePantryItems(
  current: PantryItem[],
  incoming: PantryItem[],
): PantryItem[] {
  if (incoming.length === 0) return current;

  const next = [...current];
  const indexByName = new Map<string, number>();
  next.forEach((item, index) => indexByName.set(normalizeName(item.name), index));

  let changed = false;
  for (const item of incoming) {
    const key = normalizeName(item.name);
    if (!key) continue;

    const existingIndex = indexByName.get(key);
    if (existingIndex === undefined) {
      indexByName.set(key, next.length);
      next.push(item);
      changed = true;
      continue;
    }

    const existing = next[existingIndex];
    const updated: PantryItem = {
      ...existing,
      ...(item.amount ? { amount: item.amount } : {}),
      isLowStock: false,
    };

    if (updated.amount !== existing.amount || existing.isLowStock) {
      next[existingIndex] = updated;
      changed = true;
    }
  }

  return changed ? next : current;
}
