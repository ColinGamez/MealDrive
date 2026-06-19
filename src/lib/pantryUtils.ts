import { PantryItem } from '../types';
import { normalizeName } from './ingredientUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PantryFreshnessStatus = 'none' | 'fresh' | 'useSoon' | 'expired';

export interface PantryFreshness {
  status: PantryFreshnessStatus;
  daysRemaining: number | null;
}

export function getPantryFreshness(
  item: Pick<PantryItem, 'expiresAt'>,
  now = Date.now(),
): PantryFreshness {
  if (!item.expiresAt || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiresAt)) {
    return { status: 'none', daysRemaining: null };
  }

  const expiry = new Date(`${item.expiresAt}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) {
    return { status: 'none', daysRemaining: null };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.round((expiry.getTime() - today.getTime()) / DAY_MS);

  if (daysRemaining < 0) return { status: 'expired', daysRemaining };
  if (daysRemaining <= 3) return { status: 'useSoon', daysRemaining };
  return { status: 'fresh', daysRemaining };
}

export function prioritizePantryItems(items: PantryItem[], now = Date.now()): PantryItem[] {
  const urgency: Record<PantryFreshnessStatus, number> = {
    expired: 0,
    useSoon: 1,
    fresh: 2,
    none: 3,
  };

  return [...items].sort((left, right) => {
    const leftFreshness = getPantryFreshness(left, now);
    const rightFreshness = getPantryFreshness(right, now);
    return (
      urgency[leftFreshness.status] - urgency[rightFreshness.status] ||
      (leftFreshness.daysRemaining ?? Number.POSITIVE_INFINITY) -
        (rightFreshness.daysRemaining ?? Number.POSITIVE_INFINITY)
    );
  });
}

export function getPantryGenerationContext(items: PantryItem[], now = Date.now()) {
  const prioritized = prioritizePantryItems(items, now);
  const usable = prioritized.filter((item) => getPantryFreshness(item, now).status !== 'expired');

  return {
    ingredients: usable.map((item) => item.name),
    priorityIngredients: usable
      .filter((item) => getPantryFreshness(item, now).status === 'useSoon')
      .map((item) => item.name),
  };
}

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
      ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
      isLowStock: false,
    };

    if (
      updated.amount !== existing.amount ||
      updated.expiresAt !== existing.expiresAt ||
      existing.isLowStock
    ) {
      next[existingIndex] = updated;
      changed = true;
    }
  }

  return changed ? next : current;
}
