import { Type } from "@google/genai";

export type Language = 'en' | 'ja' | 'ko';
export type ShoppingProviderId = 'instacart' | 'rakuten' | 'naver';
export type ShoppingMarket = 'northAmerica' | 'japan' | 'korea';

/** Top-level view in the App shell. */
export type View =
  | 'home'
  | 'recipes'
  | 'shopping'
  | 'meal-plan'
  | 'about'
  | 'saved'
  | 'pantry'
  | 'profile';

export interface Ingredient {
  name: string;
  amount?: string;
}

export interface PantryItem {
  id: string;
  name: string;
  amount?: string;
  isLowStock?: boolean;
  lastUsedAt?: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  preparationTime: string;
  difficulty: "Easy" | "Medium" | "Hard";
  calories: number;
  dietaryTags: string[];
  imagePrompt: string;
  rating: number;
  servings: number;
  styleNote?: string;
  /** Language the recipe text was generated in. Set client-side at API call time. */
  language?: Language;
}

export const RECIPE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      ingredients: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            amount: { type: Type.STRING },
          },
          required: ["name"],
        },
      },
      instructions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      preparationTime: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
      calories: { type: Type.NUMBER },
      dietaryTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      imagePrompt: { type: Type.STRING, description: "A prompt to generate a high-quality food photo for this recipe" },
      rating: { type: Type.NUMBER, description: "Average user rating from 1 to 5" },
      servings: { type: Type.NUMBER, description: "Number of servings this recipe makes" },
      styleNote: { type: Type.STRING, description: "A short, subtle note about the recipe's cultural context or cooking style (e.g., 'Simple Japanese home meal', 'Korean comfort classic')" },
    },
    required: ["id", "title", "description", "ingredients", "instructions", "preparationTime", "difficulty", "calories", "dietaryTags", "imagePrompt", "rating", "servings", "styleNote"],
  },
};

export interface DailyPlan {
  day: string;
  breakfast: Recipe;
  lunch: Recipe;
  dinner: Recipe;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  checked: boolean;
}

export interface ShoppingProviderSummary {
  id: ShoppingProviderId;
  name: string;
  market: ShoppingMarket;
}

export interface ShoppingSearchResult {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  merchant?: string;
  price?: string;
}

export interface ShoppingExportRequest {
  language: Language;
  items: ShoppingItem[];
}

export interface ShoppingExportResponse {
  provider: ShoppingProviderSummary;
  mode: 'link' | 'results';
  query: string;
  message: string;
  url?: string;
  results?: ShoppingSearchResult[];
}

export interface ShoppingExportErrorPayload {
  message: string;
  provider?: ShoppingProviderSummary;
  missingCredentials?: string[];
}

export interface RecentRecipe {
  recipe: Recipe;
  cookedAt: number;
}

export interface RecipeNote {
  id: string;
  recipeId: string;
  stepIndex?: number;
  content: string;
  timestamp: number;
}

export interface UserProfile {
  displayName: string;
  emojiAvatar: string;
  preferredLanguage: Language;
  dietaryPreferences: string[];
  favoriteCuisines: string[];
  cookingStyle: string;
}

export interface UserStats {
  totalCooked: number;
  weeklyCooked: number;
  streak: number;
  longestStreak: number;
  scansCompleted: number;
  rescueCount: number;
  mealPlansCreated: number;
  shoppingListUses: number;
  lastCookedAt?: number;
}

export interface KitchenIdentity {
  title: string;
  description: string;
  icon: string;
}

export type MealPlan = DailyPlan[];

export const MEAL_PLAN_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      day: { type: Type.STRING },
      breakfast: { type: Type.OBJECT, properties: RECIPE_SCHEMA.items.properties, required: RECIPE_SCHEMA.items.required },
      lunch: { type: Type.OBJECT, properties: RECIPE_SCHEMA.items.properties, required: RECIPE_SCHEMA.items.required },
      dinner: { type: Type.OBJECT, properties: RECIPE_SCHEMA.items.properties, required: RECIPE_SCHEMA.items.required },
    },
    required: ["day", "breakfast", "lunch", "dinner"],
  },
};
