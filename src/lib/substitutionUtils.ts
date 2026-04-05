import { Ingredient, PantryItem } from '../types';
import { normalizeName, parseQuantity } from './ingredientUtils';

export type SubstitutionType = 'DIRECT' | 'OMISSION' | 'BLOCKER' | 'UNKNOWN';

export interface SubstitutionRule {
  target: string; // Canonical name of the ingredient to replace
  substitutes?: string[]; // List of canonical names that can replace it
  type: SubstitutionType;
  note?: string;
  isGarnish?: boolean;
}

// Curated substitution map
// Keys are canonical names (from normalizeName)
const SUBSTITUTION_RULES: Record<string, SubstitutionRule> = {
  // Dairy
  'sour cream': { target: 'sour cream', substitutes: ['greek yogurt', 'plain yogurt'], type: 'DIRECT', note: 'Greek yogurt is a great 1:1 swap.' },
  'greek yogurt': { target: 'greek yogurt', substitutes: ['sour cream', 'plain yogurt'], type: 'DIRECT' },
  'heavy cream': { target: 'heavy cream', substitutes: ['whole milk', 'half and half'], type: 'DIRECT', note: 'Will be less thick.' },
  'butter': { target: 'butter', substitutes: ['margarine', 'olive oil', 'coconut oil'], type: 'DIRECT' },
  'milk': { target: 'milk', substitutes: ['almond milk', 'soy milk', 'oat milk'], type: 'DIRECT' },
  'buttermilk': { target: 'buttermilk', substitutes: ['milk'], type: 'DIRECT', note: 'Add 1 tsp lemon juice per cup of milk.' },

  // Sweeteners
  'honey': { target: 'honey', substitutes: ['maple syrup', 'agave nectar'], type: 'DIRECT' },
  'maple syrup': { target: 'maple syrup', substitutes: ['honey', 'agave nectar'], type: 'DIRECT' },
  'sugar': { target: 'sugar', substitutes: ['brown sugar', 'honey'], type: 'DIRECT', note: 'Honey is sweeter, use less.' },
  'brown sugar': { target: 'brown sugar', substitutes: ['sugar'], type: 'DIRECT', note: 'Add a touch of molasses if you have it.' },

  // Aromatics & Herbs
  'shallot': { target: 'shallot', substitutes: ['red onion', 'yellow onion', 'green onion'], type: 'DIRECT' },
  'garlic': { target: 'garlic', substitutes: ['garlic powder'], type: 'DIRECT', note: 'Use 1/4 tsp powder per clove.' },
  'lemon juice': { target: 'lemon juice', substitutes: ['lime juice', 'white wine vinegar', 'apple cider vinegar'], type: 'DIRECT' },
  'lime juice': { target: 'lime juice', substitutes: ['lemon juice', 'white wine vinegar'], type: 'DIRECT' },
  'cilantro': { target: 'cilantro', substitutes: ['parsley'], type: 'DIRECT', isGarnish: true },
  'parsley': { target: 'parsley', substitutes: ['cilantro', 'chive'], type: 'DIRECT', isGarnish: true },
  'green onion': { target: 'green onion', substitutes: ['chive', 'scallion'], type: 'DIRECT', isGarnish: true },
  'chive': { target: 'chive', substitutes: ['green onion'], type: 'DIRECT', isGarnish: true },

  // Pantry Staples
  'soy sauce': { target: 'soy sauce', substitutes: ['tamari', 'coconut aminos', 'liquid aminos'], type: 'DIRECT' },
  'chicken broth': { target: 'chicken broth', substitutes: ['vegetable broth', 'water'], type: 'DIRECT', note: 'Water may need extra salt.' },
  'vegetable broth': { target: 'vegetable broth', substitutes: ['chicken broth', 'water'], type: 'DIRECT' },
  'mayonnaise': { target: 'mayonnaise', substitutes: ['greek yogurt', 'sour cream'], type: 'DIRECT' },
  'ketchup': { target: 'ketchup', substitutes: ['tomato paste'], type: 'DIRECT', note: 'Add sugar and vinegar to tomato paste.' },

  // Blockers (Too central to swap safely in most contexts)
  'egg': { target: 'egg', type: 'BLOCKER', note: 'Hard to replace without changing texture significantly.' },
  'flour': { target: 'flour', type: 'BLOCKER', note: 'Core structural ingredient.' },
  'yeast': { target: 'yeast', type: 'BLOCKER' },
  'baking powder': { target: 'baking powder', type: 'BLOCKER' },
  'baking soda': { target: 'baking soda', type: 'BLOCKER' },

  // Omissions (Safe to skip)
  'sesame seed': { target: 'sesame seed', type: 'OMISSION', isGarnish: true },
  'red pepper flake': { target: 'red pepper flake', type: 'OMISSION', note: 'Skip if you don\'t want heat.' },
  'black pepper': { target: 'black pepper', type: 'OMISSION' },
};

const GARNISH_KEYWORDS = ['garnish', 'topping', 'optional', 'to serve', 'for serving'];

export interface SubstitutionResult {
  originalIngredient: string;
  substituteIngredient?: string;
  type: SubstitutionType;
  note?: string;
  isAvailable: boolean;
  canOmit: boolean;
}

export function findSubstitution(ingredient: Ingredient, pantry: PantryItem[]): SubstitutionResult {
  const normalizedName = normalizeName(ingredient.name);
  const rule = SUBSTITUTION_RULES[normalizedName];
  
  // 1. Check if it's a garnish or optional by name/description
  const isOptional = GARNISH_KEYWORDS.some(kw => ingredient.name.toLowerCase().includes(kw));
  
  if (isOptional || (rule && rule.type === 'OMISSION')) {
    return {
      originalIngredient: ingredient.name,
      type: 'OMISSION',
      isAvailable: false,
      canOmit: true,
      note: rule?.note || 'This ingredient is optional or a garnish.'
    };
  }

  if (rule) {
    if (rule.type === 'BLOCKER') {
      return {
        originalIngredient: ingredient.name,
        type: 'BLOCKER',
        isAvailable: false,
        canOmit: false,
        note: rule.note || 'No safe substitute detected for this core ingredient.'
      };
    }

    if (rule.type === 'DIRECT' && rule.substitutes) {
      // Find a substitute that exists in the pantry
      for (const subName of rule.substitutes) {
        const matchingPantryItem = pantry.find(item => {
          const normPantry = normalizeName(item.name);
          return normPantry.includes(subName) || subName.includes(normPantry);
        });

        if (matchingPantryItem) {
          // Check quantity if possible (conservative 1:1 check)
          const recipeQty = parseQuantity(ingredient.amount || '');
          const pantryQty = parseQuantity(matchingPantryItem.amount || '');
          
          // If units match and we have enough, or if we don't have amounts to compare
          if (!recipeQty.value || !pantryQty.value || (recipeQty.unit === pantryQty.unit && pantryQty.value >= recipeQty.value)) {
            return {
              originalIngredient: ingredient.name,
              substituteIngredient: matchingPantryItem.name,
              type: 'DIRECT',
              isAvailable: true,
              canOmit: false,
              note: rule.note || `You can use ${matchingPantryItem.name} instead.`
            };
          }
        }
      }
    }
  }

  return {
    originalIngredient: ingredient.name,
    type: 'UNKNOWN',
    isAvailable: false,
    canOmit: false
  };
}
