import { Recipe, MealPlan, Language } from '../types';

const CLIENT_TIMEOUT_MS = 30000;

/**
 * AI calls used to live in this file and ran in the browser, which leaked
 * GEMINI_API_KEY into the client bundle. Every call now goes through the
 * Express server (see server/geminiApi.ts), which keeps the key off the
 * client and lets us swap providers later without touching components.
 */

class AIServiceError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new AIServiceError(
      timedOut ? 'The AI request timed out. Please try again.' : 'Unable to reach the AI service.',
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* empty / non-JSON */
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request to ${url} failed with status ${response.status}`;
    throw new AIServiceError(message, response.status);
  }

  return payload as T;
}

export const analyzeFridgeImage = async (
  base64Image: string,
  language: Language = 'en',
): Promise<string[]> => {
  const data = await postJson<{ ingredients: string[] }>('/api/ai/analyze-fridge', {
    image: base64Image,
    language,
  });
  return Array.isArray(data?.ingredients) ? data.ingredients : [];
};

export const generateRecipes = async (
  ingredients: string[],
  dietaryRestrictions: string[],
  language: Language = 'en',
): Promise<Recipe[]> => {
  const data = await postJson<{ recipes: Recipe[] }>('/api/ai/recipes', {
    ingredients,
    dietaryRestrictions,
    language,
  });
  // Tag each recipe with the language it was generated in so the UI can flag
  // mismatches when the user later switches languages.
  return Array.isArray(data?.recipes) ? data.recipes.map(r => ({ ...r, language })) : [];
};

export const generateMealPlan = async (
  ingredients: string[],
  dietaryRestrictions: string[],
  cuisines: string[],
  language: Language = 'en',
): Promise<MealPlan> => {
  const data = await postJson<{ plan: MealPlan }>('/api/ai/meal-plan', {
    ingredients,
    dietaryRestrictions,
    cuisines,
    language,
  });
  if (!Array.isArray(data?.plan)) return [];
  return data.plan.map(day => ({
    ...day,
    breakfast: { ...day.breakfast, language },
    lunch: { ...day.lunch, language },
    dinner: { ...day.dinner, language },
  }));
};

export const swapMeal = async (
  currentMeal: Recipe,
  ingredients: string[],
  dietaryRestrictions: string[],
  cuisines: string[],
  language: Language = 'en',
): Promise<Recipe> => {
  const data = await postJson<{ recipe: Recipe }>('/api/ai/swap-meal', {
    currentMeal,
    ingredients,
    dietaryRestrictions,
    cuisines,
    language,
  });
  return data?.recipe ? { ...data.recipe, language } : currentMeal;
};

export const generateSpeech = async (
  text: string,
  language: Language = 'en',
): Promise<string> => {
  const data = await postJson<{ audioUrl: string }>('/api/ai/speech', {
    text,
    language,
  });
  if (!data?.audioUrl) throw new AIServiceError('Failed to generate speech');
  return data.audioUrl;
};

export { AIServiceError };
