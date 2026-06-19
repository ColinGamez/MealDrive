import './env';
import { Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  Language,
  RECIPE_SCHEMA,
  MEAL_PLAN_SCHEMA,
  Recipe,
  MealPlan,
} from '../src/types';

const PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ja' || value === 'ko';
}

function getLanguageInstructions(language: Language): string {
  switch (language) {
    case 'ja':
      return `Respond entirely in Japanese.
- Use natural cooking terminology (e.g., '作り方' for instructions, '材料' for ingredients).
- Ensure the tone is polite and helpful (Desu/Masu style).
- All names, descriptions, and instructions must be in Japanese.
- Do NOT include any English words unless they are common loanwords in Japanese cooking.
- Use metric units (g, ml, cm) as they are standard in Japan.
- REGIONAL STYLE: Focus on Japanese home cooking (家庭料理 - Katei Ryori).
- PREFERRED DISHES: Suggest practical meals like 丼物 (donburi), 味噌汁 (miso soup), 焼き魚 (grilled fish), and simple おかず (side dishes).
- PRACTICALITY: Prioritize simple, realistic meals that a Japanese person would actually cook at home. Avoid overly complex restaurant-style dishes unless requested.`;
    case 'ko':
      return `Respond entirely in Korean.
- Use natural cooking terminology (e.g., '조리법' for instructions, '재료' for ingredients).
- Use a friendly, modern, and helpful tone.
- All names, descriptions, and instructions must be in Korean.
- Do NOT include any English words unless they are common loanwords in Korean cooking.
- Use metric units (g, ml, cm) as they are standard in Korea.
- REGIONAL STYLE: Focus on Korean home meals (집밥 - Jipbab).
- PREFERRED DISHES: Suggest practical meals like 국/찌개 (soups/stews), 반찬 (side dishes), and 볶음 요리 (stir-fries).
- PRACTICALITY: Emphasize a shared meal style and realistic Korean pantry usage. Suggest dishes that are common in a typical Korean household.`;
    default:
      return `Respond entirely in English.
- Use natural, friendly cooking terminology.
- All names, descriptions, and instructions must be in English.
- Use common cooking measurements (cups, tbsp, tsp, lbs, oz).
- REGIONAL STYLE: Keep the style flexible and global but highly practical for home cooking.
- PRACTICALITY: Avoid overly fancy or complex recipes. Focus on realistic, everyday meals that use common pantry staples.`;
  }
}

function unauthenticated(res: Response) {
  res.status(503).json({
    message:
      'Gemini API key is not configured on the server. Set GEMINI_API_KEY in your environment.',
  });
}

function badRequest(res: Response, message: string) {
  res.status(400).json({ message });
}

function payloadTooLarge(res: Response, message: string) {
  res.status(413).json({ message });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.title === 'string' && Array.isArray(r.ingredients);
}

function parseImagePayload(value: string): { data: string; mimeType: string } | null {
  const dataUrl = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (value.startsWith('data:') && !dataUrl) return null;

  const data = (dataUrl?.[2] ?? value).replace(/\s/g, '');
  if (!data || data.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return null;
  }

  const mimeType = dataUrl ? `image/${dataUrl[1].toLowerCase()}` : 'image/jpeg';
  return { data, mimeType };
}

/* ------------------------------------------------------------------ */
/* POST /api/ai/analyze-fridge                                         */
/* ------------------------------------------------------------------ */
export async function handleAnalyzeFridge(req: Request, res: Response) {
  const body = req.body as { image?: unknown; language?: unknown } | undefined;
  const image = typeof body?.image === 'string' ? body.image : '';
  const language = isLanguage(body?.language) ? body!.language : 'en';

  if (!image) return badRequest(res, 'Missing `image` (base64 data URL).');

  const parsedImage = parseImagePayload(image);
  if (!parsedImage) return badRequest(res, 'Invalid base64 image payload.');
  if (Buffer.byteLength(parsedImage.data, 'base64') > MAX_IMAGE_BYTES) {
    return payloadTooLarge(res, 'Image payload exceeds the 8 MB limit.');
  }

  const ai = getClient();
  if (!ai) return unauthenticated(res);

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: [
        {
          parts: [
            {
              text: `${getLanguageInstructions(language)}\nIdentify all visible food ingredients in this fridge. Return only a comma-separated list of ingredients in the specified language. Use common regional names for ingredients.`,
            },
            { inlineData: parsedImage },
          ],
        },
      ],
    });

    const text = response.text || '';
    const ingredients = text
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);

    res.json({ ingredients });
  } catch (err) {
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : 'Gemini request failed.' });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/ai/recipes                                                */
/* ------------------------------------------------------------------ */
export async function handleGenerateRecipes(req: Request, res: Response) {
  const body = req.body as
    | {
        ingredients?: unknown;
        dietaryRestrictions?: unknown;
        language?: unknown;
      }
    | undefined;

  if (!isStringArray(body?.ingredients)) {
    return badRequest(res, '`ingredients` must be an array of strings.');
  }
  if (body?.dietaryRestrictions !== undefined && !isStringArray(body.dietaryRestrictions)) {
    return badRequest(res, '`dietaryRestrictions` must be an array of strings.');
  }

  const ingredients = body.ingredients;
  const dietaryRestrictions = isStringArray(body?.dietaryRestrictions)
    ? body!.dietaryRestrictions
    : [];
  const language = isLanguage(body?.language) ? body!.language : 'en';

  const ai = getClient();
  if (!ai) return unauthenticated(res);

  const prompt = `${getLanguageInstructions(language)}
  Based on these ingredients: ${ingredients.join(', ')}, suggest 5 creative recipes.
  Consider these dietary restrictions: ${dietaryRestrictions.join(', ')}.
  For each recipe, provide a detailed description, ingredients (mark if missing), step-by-step instructions, preparation time, difficulty, calories, dietary tags, a rating from 1 to 5, and a subtle 'styleNote' (e.g., 'Simple Japanese home meal', 'Korean comfort classic', 'Quick everyday favorite').

  CULTURAL CONSTRAINTS:
  - Ensure ingredient combinations make cultural sense for the selected region.
  - Avoid mismatched cuisine mixes.
  - Substitutions should respect regional norms.
  - Focus on "realistic home cooking" that uses available ingredients effectively.
  - The 'styleNote' should be short, natural, and non-technical, reflecting the recipe's cultural or lifestyle fit.`;

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RECIPE_SCHEMA,
      },
    });

    let recipes: Recipe[] = [];
    try {
      recipes = JSON.parse(response.text || '[]') as Recipe[];
    } catch {
      recipes = [];
    }

    res.json({ recipes });
  } catch (err) {
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : 'Gemini request failed.' });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/ai/meal-plan                                              */
/* ------------------------------------------------------------------ */
export async function handleGenerateMealPlan(req: Request, res: Response) {
  const body = req.body as
    | {
        ingredients?: unknown;
        dietaryRestrictions?: unknown;
        cuisines?: unknown;
        language?: unknown;
      }
    | undefined;

  if (!isStringArray(body?.ingredients)) {
    return badRequest(res, '`ingredients` must be an array of strings.');
  }
  if (body?.dietaryRestrictions !== undefined && !isStringArray(body.dietaryRestrictions)) {
    return badRequest(res, '`dietaryRestrictions` must be an array of strings.');
  }
  if (body?.cuisines !== undefined && !isStringArray(body.cuisines)) {
    return badRequest(res, '`cuisines` must be an array of strings.');
  }

  const ingredients = body.ingredients;
  const dietaryRestrictions = isStringArray(body?.dietaryRestrictions)
    ? body!.dietaryRestrictions
    : [];
  const cuisines = isStringArray(body?.cuisines) ? body!.cuisines : [];
  const language = isLanguage(body?.language) ? body!.language : 'en';

  const ai = getClient();
  if (!ai) return unauthenticated(res);

  const prompt = `${getLanguageInstructions(language)}
  Generate a 7-day meal plan (Monday to Sunday) based on these available ingredients: ${ingredients.join(', ')}.
  Dietary restrictions: ${dietaryRestrictions.join(', ')}.
  Preferred cuisines: ${cuisines.join(', ')}.
  For each day, provide a breakfast, lunch, and dinner recipe.
  Each recipe must include a detailed description, ingredients, instructions, preparation time, difficulty, calories, dietary tags, a rating, and a subtle 'styleNote'.

  CULTURAL CONSTRAINTS:
  - Ensure the meal plan reflects typical regional eating habits (e.g., typical Japanese breakfast vs. typical English breakfast).
  - Use realistic ingredient combinations that a home cook in that region would use.
  - Prioritize "realistic home cooking" over restaurant-style dishes.
  - The 'styleNote' should be short, natural, and non-technical, reflecting the recipe's cultural or lifestyle fit.`;

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });

    let plan: MealPlan = [];
    try {
      plan = JSON.parse(response.text || '[]') as MealPlan;
    } catch {
      plan = [];
    }

    res.json({ plan });
  } catch (err) {
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : 'Gemini request failed.' });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/ai/swap-meal                                              */
/* ------------------------------------------------------------------ */
export async function handleSwapMeal(req: Request, res: Response) {
  const body = req.body as
    | {
        currentMeal?: unknown;
        ingredients?: unknown;
        dietaryRestrictions?: unknown;
        cuisines?: unknown;
        language?: unknown;
      }
    | undefined;

  if (!isRecipe(body?.currentMeal)) {
    return badRequest(res, 'Missing or invalid `currentMeal`.');
  }
  if (body?.ingredients !== undefined && !isStringArray(body.ingredients)) {
    return badRequest(res, '`ingredients` must be an array of strings.');
  }
  if (body?.dietaryRestrictions !== undefined && !isStringArray(body.dietaryRestrictions)) {
    return badRequest(res, '`dietaryRestrictions` must be an array of strings.');
  }
  if (body?.cuisines !== undefined && !isStringArray(body.cuisines)) {
    return badRequest(res, '`cuisines` must be an array of strings.');
  }

  const currentMeal = body!.currentMeal as Recipe;
  const ingredients = isStringArray(body?.ingredients) ? body!.ingredients : [];
  const dietaryRestrictions = isStringArray(body?.dietaryRestrictions)
    ? body!.dietaryRestrictions
    : [];
  const cuisines = isStringArray(body?.cuisines) ? body!.cuisines : [];
  const language = isLanguage(body?.language) ? body!.language : 'en';

  const ai = getClient();
  if (!ai) return unauthenticated(res);

  const prompt = `${getLanguageInstructions(language)}
  Suggest a different recipe to replace this one: ${currentMeal.title}.
  Available ingredients: ${ingredients.join(', ')}.
  Dietary restrictions: ${dietaryRestrictions.join(', ')}.
  Preferred cuisines: ${cuisines.join(', ')}.
  Provide a detailed description, ingredients, instructions, preparation time, difficulty, calories, dietary tags, a rating, and a subtle 'styleNote'.
  Return only ONE recipe object.

  CULTURAL CONSTRAINTS:
  - The replacement should be culturally consistent with the original recipe's theme or the regional preferences.
  - Focus on "realistic home cooking" and practical ingredient usage.
  - The 'styleNote' should be short, natural, and non-technical, reflecting the recipe's cultural or lifestyle fit.`;

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RECIPE_SCHEMA.items,
      },
    });

    let recipe: Recipe = currentMeal;
    try {
      recipe = JSON.parse(response.text || '{}') as Recipe;
    } catch {
      recipe = currentMeal;
    }

    res.json({ recipe });
  } catch (err) {
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : 'Gemini request failed.' });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/ai/speech                                                 */
/* ------------------------------------------------------------------ */
export async function handleGenerateSpeech(req: Request, res: Response) {
  const body = req.body as { text?: unknown; language?: unknown } | undefined;
  const text = typeof body?.text === 'string' ? body.text : '';
  const language = isLanguage(body?.language) ? body!.language : 'en';

  if (!text.trim()) return badRequest(res, 'Missing `text`.');

  const ai = getClient();
  if (!ai) return unauthenticated(res);

  const voiceMap: Record<Language, string> = {
    en: 'Kore',
    ja: 'Kore',
    ko: 'Kore',
  };

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [
        {
          parts: [
            { text: `Read this cooking instruction clearly in the appropriate language: ${text}` },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceMap[language] || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ message: 'Gemini did not return audio.' });
    }

    res.json({ audioUrl: `data:audio/mp3;base64,${base64Audio}` });
  } catch (err) {
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : 'Gemini request failed.' });
  }
}
