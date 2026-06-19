import { Ingredient, PantryItem, Recipe } from '../types';
import { findSubstitution, SubstitutionResult } from './substitutionUtils';

export type IngredientStatus =
  | 'available'
  | 'partial'
  | 'missing'
  | 'unknown'
  | 'substitute_available'
  | 'can_omit';

export interface IngredientCheck {
  /**
   * Pantry item id when there is a matching pantry entry, otherwise omitted.
   * Do NOT use this as a React key for unmatched checks - use `name` instead,
   * which is stable across renders.
   */
  pantryId?: string;
  name: string;
  requiredAmount: string;
  pantryAmount?: string;
  status: IngredientStatus;
  missingAmount?: string;
  substitution?: SubstitutionResult;
}

const SYNONYMS: Record<string, string> = {
  'scallion': 'green onion',
  'green onion': 'green onion',
  'cilantro': 'coriander',
  'coriander': 'coriander',
  'zucchini': 'courgette',
  'courgette': 'courgette',
  'eggplant': 'aubergine',
  'aubergine': 'aubergine',
  'bell pepper': 'capsicum',
  'capsicum': 'capsicum',
  'soy sauce': 'soy sauce',
  'low sodium soy sauce': 'soy sauce',
  'mozzarella': 'mozzarella',
  'mozzarella cheese': 'mozzarella',
  'parmesan': 'parmesan',
  'parmesan cheese': 'parmesan',
  'cheddar': 'cheddar',
  'cheddar cheese': 'cheddar',
};

const STOP_WORDS = ['fresh', 'organic', 'large', 'small', 'medium', 'dried', 'ground', 'whole', 'clove', 'cloves', 'of'];

/**
 * Singularize an English noun using a small ruleset that handles the common
 * cases the previous version got wrong:
 *   tomatoes -> tomato (not "tomatoe")
 *   potatoes -> potato
 *   leaves   -> leaf
 *   berries  -> berry
 *   onions   -> onion
 *   cheese   -> cheese (don't strip 'es' from already-singular words)
 */
function singularize(word: string): string {
  if (word.length <= 3) return word;
  const lower = word;

  if (lower.endsWith('ss') || lower.endsWith('sis') || lower.endsWith('us')) return lower;
  if (lower.endsWith('se') && !lower.endsWith('ies')) {
    return lower;
  }
  if (lower.endsWith('ies') && lower.length > 4) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ves') && lower.length > 4) {
    return lower.slice(0, -3) + 'f';
  }
  if (lower.endsWith('oes') && lower.length > 4) {
    return lower.slice(0, -2);
  }
  if (
    (lower.endsWith('xes') || lower.endsWith('shes') || lower.endsWith('ches')) &&
    lower.length > 4
  ) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    return lower.slice(0, -1);
  }
  return lower;
}

export function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();

  STOP_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, '');
  });

  normalized = normalized.trim().replace(/\s+/g, ' ');

  normalized = normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => singularize(token))
    .join(' ');

  for (const [synonym, canonical] of Object.entries(SYNONYMS)) {
    if (normalized.includes(synonym)) {
      return canonical;
    }
  }

  return normalized;
}

export function parseQuantity(amount: string): { value: number; unit: string } {
  if (!amount) return { value: 0, unit: '' };

  const fractionMatch = amount.match(/(\d+)?\s*(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1] || '0');
    const num = parseInt(fractionMatch[2]);
    const den = parseInt(fractionMatch[3]);
    const value = whole + (num / den);
    const unit = amount.replace(fractionMatch[0], '').trim();
    return { value, unit: normalizeUnit(unit) };
  }

  const numberMatch = amount.match(/(\d+(\.\d+)?)/);
  if (numberMatch) {
    const value = parseFloat(numberMatch[1]);
    const unit = amount.replace(numberMatch[1], '').trim();
    return { value, unit: normalizeUnit(unit) };
  }

  return { value: 0, unit: amount.trim() };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u.startsWith('cup')) return 'cup';
  if (u.startsWith('tbsp') || u.includes('tablespoon')) return 'tbsp';
  if (u.startsWith('tsp') || u.includes('teaspoon')) return 'tsp';
  if (u.startsWith('oz') || u.includes('ounce')) return 'oz';
  if (u.startsWith('lb') || u.includes('pound')) return 'lb';
  if (u.startsWith('g') && !u.startsWith('gr')) return 'g';
  if (u.startsWith('kg')) return 'kg';
  if (u.startsWith('ml')) return 'ml';
  if (u.startsWith('l') && !u.startsWith('lb')) return 'l';
  return u;
}

export function checkIngredient(recipeIng: Ingredient, pantryItems: PantryItem[]): IngredientCheck {
  const normalizedRecipeName = normalizeName(recipeIng.name);
  const matchingPantryItem = pantryItems.find(item => {
    const normItem = normalizeName(item.name);
    return normItem.includes(normalizedRecipeName) || normalizedRecipeName.includes(normItem);
  });

  if (!matchingPantryItem) {
    const sub = findSubstitution(recipeIng, pantryItems);
    if (sub.isAvailable) {
      return {
        name: recipeIng.name,
        requiredAmount: recipeIng.amount || '',
        status: 'substitute_available',
        substitution: sub,
      };
    }
    if (sub.canOmit) {
      return {
        name: recipeIng.name,
        requiredAmount: recipeIng.amount || '',
        status: 'can_omit',
        substitution: sub,
      };
    }

    return {
      name: recipeIng.name,
      requiredAmount: recipeIng.amount || '',
      status: 'missing',
      substitution: sub,
    };
  }

  if (!recipeIng.amount || !matchingPantryItem.amount) {
    return {
      pantryId: matchingPantryItem.id,
      name: recipeIng.name,
      requiredAmount: recipeIng.amount || '',
      pantryAmount: matchingPantryItem.amount,
      status: 'available',
    };
  }

  const recipeQty = parseQuantity(recipeIng.amount);
  const pantryQty = parseQuantity(matchingPantryItem.amount);

  if (recipeQty.unit !== pantryQty.unit && recipeQty.unit !== '' && pantryQty.unit !== '') {
    return {
      pantryId: matchingPantryItem.id,
      name: recipeIng.name,
      requiredAmount: recipeIng.amount,
      pantryAmount: matchingPantryItem.amount,
      status: 'unknown',
    };
  }

  if (pantryQty.value >= recipeQty.value) {
    return {
      pantryId: matchingPantryItem.id,
      name: recipeIng.name,
      requiredAmount: recipeIng.amount,
      pantryAmount: matchingPantryItem.amount,
      status: 'available',
    };
  }

  const diff = recipeQty.value - pantryQty.value;
  return {
    pantryId: matchingPantryItem.id,
    name: recipeIng.name,
    requiredAmount: recipeIng.amount,
    pantryAmount: matchingPantryItem.amount,
    status: 'partial',
    missingAmount: `${diff} ${recipeQty.unit}`.trim(),
  };
}

/** Translation key + params bundle. Consumer calls `t(key, params)`. */
export interface RescueMessage {
  key: string;
  params?: Record<string, string | number>;
}

export interface RecipePantryStatus {
  missingCount: number;
  partialCount: number;
  availableCount: number;
  unknownCount: number;
  substituteCount: number;
  omitCount: number;
  isCanMakeNow: boolean;
  isAlmostThere: boolean;
  isCookWithSwaps: boolean;
  rescueMessage: RescueMessage | null;
}

export function getRecipePantryStatus(recipe: Recipe, pantry: PantryItem[]): RecipePantryStatus {
  const checks = recipe.ingredients.map(ing => checkIngredient(ing, pantry));
  const missingCount = checks.filter(c => c.status === 'missing').length;
  const partialCount = checks.filter(c => c.status === 'partial').length;
  const availableCount = checks.filter(c => c.status === 'available').length;
  const unknownCount = checks.filter(c => c.status === 'unknown').length;
  const substituteCount = checks.filter(c => c.status === 'substitute_available').length;
  const omitCount = checks.filter(c => c.status === 'can_omit').length;

  const isCanMakeNow =
    missingCount === 0 &&
    partialCount === 0 &&
    unknownCount === 0 &&
    substituteCount === 0 &&
    omitCount === 0;

  const isCookWithSwaps =
    !isCanMakeNow &&
    missingCount === 0 &&
    (substituteCount > 0 || omitCount > 0) &&
    partialCount === 0 &&
    unknownCount === 0;

  const totalMissing =
    missingCount + partialCount + unknownCount + substituteCount + omitCount;
  const isAlmostThere = totalMissing > 0 && totalMissing <= 2;

  let rescueMessage: RescueMessage | null = null;
  if (isCookWithSwaps) {
    if (substituteCount > 0 && omitCount > 0) {
      rescueMessage = {
        key: 'rescue.swapAndSkip',
        params: { swap: substituteCount, omit: omitCount },
      };
    } else if (substituteCount > 0) {
      rescueMessage = {
        key: substituteCount > 1 ? 'rescue.swapPlural' : 'rescue.swapSingle',
        params: { n: substituteCount },
      };
    } else if (omitCount > 0) {
      rescueMessage = {
        key: omitCount > 1 ? 'rescue.skipPlural' : 'rescue.skipSingle',
        params: { n: omitCount },
      };
    }
  } else if (isAlmostThere) {
    const actionable = substituteCount + omitCount;
    if (actionable > 0) {
      rescueMessage = {
        key: actionable > 1 ? 'rescue.awayWithSwapsPlural' : 'rescue.awayWithSwapsSingle',
        params: { total: totalMissing, actionable },
      };
    } else {
      rescueMessage = {
        key: totalMissing > 1 ? 'rescue.awayPlural' : 'rescue.awaySingle',
        params: { total: totalMissing },
      };
    }
  }

  return {
    missingCount,
    partialCount,
    availableCount,
    unknownCount,
    substituteCount,
    omitCount,
    isCanMakeNow,
    isAlmostThere,
    isCookWithSwaps,
    rescueMessage,
  };
}

export function formatQuantity(value: number, unit: string): string {
  if (value <= 0) return `0 ${unit}`.trim();

  const tolerance = 0.01;
  const whole = Math.floor(value);
  const frac = value - whole;

  let fracStr = '';
  if (Math.abs(frac - 0.25) < tolerance) fracStr = '1/4';
  else if (Math.abs(frac - 0.33) < tolerance) fracStr = '1/3';
  else if (Math.abs(frac - 0.5) < tolerance) fracStr = '1/2';
  else if (Math.abs(frac - 0.66) < tolerance) fracStr = '2/3';
  else if (Math.abs(frac - 0.75) < tolerance) fracStr = '3/4';
  else if (frac > tolerance) fracStr = frac.toFixed(2).replace(/\.?0+$/, '');

  const result = `${whole > 0 ? whole : ''} ${fracStr}`.trim();
  return `${result} ${unit}`.trim();
}

export interface DeductionResult {
  updatedPantry: PantryItem[];
  deductions: {
    name: string;
    oldAmount: string;
    newAmount: string;
    deductedAmount: string;
  }[];
  skipped: {
    name: string;
    reason: 'missing' | 'incompatible_units' | 'no_quantity' | 'unknown';
  }[];
}

export function deductIngredients(recipeIngredients: Ingredient[], pantry: PantryItem[]): DeductionResult {
  const updatedPantry = [...pantry];
  const deductions: DeductionResult['deductions'] = [];
  const skipped: DeductionResult['skipped'] = [];

  const groupedRecipeIngs: Record<string, { name: string, value: number, unit: string, originalAmounts: string[] }> = {};

  recipeIngredients.forEach(ing => {
    const normalized = normalizeName(ing.name);
    const { value, unit } = parseQuantity(ing.amount || '');

    if (!groupedRecipeIngs[normalized]) {
      groupedRecipeIngs[normalized] = { name: ing.name, value: 0, unit, originalAmounts: [] };
    }

    const group = groupedRecipeIngs[normalized];
    if (group.unit === unit || group.unit === '' || unit === '') {
      group.value += value;
      if (unit !== '') group.unit = unit;
    }
    group.originalAmounts.push(ing.amount || '');
  });

  Object.keys(groupedRecipeIngs).forEach(normalizedName => {
    const recipeGroup = groupedRecipeIngs[normalizedName];

    const pantryIdx = updatedPantry.findIndex(item =>
      normalizeName(item.name).includes(normalizedName) ||
      normalizedName.includes(normalizeName(item.name)),
    );

    if (pantryIdx === -1) {
      skipped.push({ name: recipeGroup.name, reason: 'missing' });
      return;
    }

    const pantryItem = updatedPantry[pantryIdx];

    if (!recipeGroup.value || !pantryItem.amount) {
      skipped.push({ name: recipeGroup.name, reason: 'no_quantity' });
      return;
    }

    const pantryQty = parseQuantity(pantryItem.amount);

    if (recipeGroup.unit !== pantryQty.unit && recipeGroup.unit !== '' && pantryQty.unit !== '') {
      skipped.push({ name: recipeGroup.name, reason: 'incompatible_units' });
      return;
    }

    const newValue = Math.max(0, pantryQty.value - recipeGroup.value);
    const oldAmount = pantryItem.amount;
    const newAmount = formatQuantity(newValue, pantryQty.unit);
    const deductedAmount = formatQuantity(recipeGroup.value, recipeGroup.unit);

    const isLowStock = newValue > 0 && (
      newValue < 0.3 * pantryQty.value ||
      (pantryQty.unit === 'g' || pantryQty.unit === 'ml' ? newValue < 50 : newValue < 0.5)
    );

    deductions.push({
      name: pantryItem.name,
      oldAmount,
      newAmount,
      deductedAmount,
    });

    if (newValue <= 0) {
      updatedPantry.splice(pantryIdx, 1);
    } else {
      updatedPantry[pantryIdx] = {
        ...pantryItem,
        amount: newAmount,
        isLowStock,
        lastUsedAt: Date.now(),
      };
    }
  });

  return { updatedPantry, deductions, skipped };
}
