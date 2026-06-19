import { Recipe, PantryItem } from '../types';
import { getRecipePantryStatus } from './ingredientUtils';

export function getRecipeReason(recipe: Recipe, pantry: PantryItem[]): string {
  const pantryStatus = getRecipePantryStatus(recipe, pantry);

  // 1. Full pantry match
  if (pantryStatus.isCanMakeNow) {
    return 'reasons.canMakeNow';
  }

  // 2. Cook with Swaps (Pantry Rescue)
  if (pantryStatus.isCookWithSwaps) {
    return 'reasons.pantryRescue';
  }

  // 3. Near match (Only 1 missing)
  if (pantryStatus.missingCount === 1) {
    return 'reasons.oneMissing';
  }

  // 4. Quick (Under 20 mins)
  const prepTimeMatch = recipe.preparationTime.match(/(\d+)/);
  if (prepTimeMatch) {
    const mins = parseInt(prepTimeMatch[1]);
    if (mins <= 20 && !recipe.preparationTime.toLowerCase().includes('hr')) {
      return 'reasons.quickMeal';
    }
  }

  // 5. Low effort (Easy difficulty)
  if (recipe.difficulty === 'Easy') {
    return 'reasons.lowEffort';
  }

  // 6. Fallback
  return 'reasons.fastAndEasy';
}
