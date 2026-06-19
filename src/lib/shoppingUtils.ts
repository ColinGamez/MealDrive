import { ShoppingItem } from '../types';
import { normalizeName, parseQuantity } from './ingredientUtils';

/**
 * Merge a new amount string into an existing one when possible.
 *
 * Rules:
 * - If the new amount is empty, keep the existing one untouched.
 * - If the existing amount is empty, take the new one verbatim.
 * - If both parse to the same unit AND both have positive numeric values,
 *   sum the values (e.g. "1 cup" + "2 cups" → "3 cup").
 * - Otherwise, preserve both with a "+" separator so the shopper still sees
 *   everything they need (e.g. "1 cup" + "2 tbsp" → "1 cup + 2 tbsp").
 */
export function mergeAmounts(existing: string | undefined, incoming: string): string | undefined {
  const existingAmount = (existing ?? '').trim();
  const newAmount = incoming.trim();

  if (!newAmount) return existing;
  if (!existingAmount) return newAmount;

  const existingQty = parseQuantity(existingAmount);
  const newQty = parseQuantity(newAmount);
  const sameUnit = existingQty.unit === newQty.unit;
  const haveValues = existingQty.value > 0 && newQty.value > 0;

  if (sameUnit && haveValues) {
    const merged = existingQty.value + newQty.value;
    return `${merged} ${existingQty.unit}`.trim();
  }
  return `${existingAmount} + ${newAmount}`;
}

/**
 * Add an item to the shopping list, deduping by normalized name. When a
 * duplicate is found, the amounts are merged via {@link mergeAmounts}.
 *
 * `idFactory` is injected so tests can produce stable ids.
 */
export function addItemToList(
  list: ShoppingItem[],
  name: string,
  amount: string,
  idFactory: () => string,
): ShoppingItem[] {
  const nameKey = normalizeName(name);
  const index = list.findIndex(item => normalizeName(item.name) === nameKey);

  if (index !== -1) {
    const next = [...list];
    const existing = next[index];
    const mergedAmount = mergeAmounts(existing.amount, amount);
    // mergeAmounts returns the same string when there's nothing new to merge,
    // so the no-op case still flows through here without forcing a re-render
    // upstream — callers should compare references if they care.
    if (mergedAmount === existing.amount) return list;
    next[index] = { ...existing, amount: mergedAmount };
    return next;
  }
  return [...list, { id: idFactory(), name, amount, checked: false }];
}
