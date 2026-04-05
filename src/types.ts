import { Type } from "@google/genai";

export type Language = 'en' | 'ja' | 'ko';

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
    },
    required: ["id", "title", "description", "ingredients", "instructions", "preparationTime", "difficulty", "calories", "dietaryTags", "imagePrompt", "rating", "servings"],
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

export interface RecentRecipe {
  recipe: Recipe;
  cookedAt: number;
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
