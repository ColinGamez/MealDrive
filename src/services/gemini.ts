import { GoogleGenAI, Modality } from "@google/genai";
import { RECIPE_SCHEMA, Recipe, MEAL_PLAN_SCHEMA, MealPlan, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const getLanguageInstructions = (language: Language): string => {
  switch (language) {
    case 'ja':
      return `Respond entirely in Japanese. 
      - Use natural cooking terminology (e.g., '作り方' for instructions, '材料' for ingredients). 
      - Ensure the tone is polite and helpful (Desu/Masu style). 
      - All names, descriptions, and instructions must be in Japanese. 
      - Do NOT include any English words unless they are common loanwords in Japanese cooking. 
      - Use metric units (g, ml, cm) as they are standard in Japan.`;
    case 'ko':
      return `Respond entirely in Korean. 
      - Use natural cooking terminology (e.g., '조리법' for instructions, '재료' for ingredients). 
      - Use a friendly, modern, and helpful tone. 
      - All names, descriptions, and instructions must be in Korean. 
      - Do NOT include any English words unless they are common loanwords in Korean cooking. 
      - Use metric units (g, ml, cm) as they are standard in Korea.`;
    default:
      return `Respond entirely in English. 
      - Use natural, friendly cooking terminology. 
      - All names, descriptions, and instructions must be in English. 
      - Use common cooking measurements (cups, tbsp, tsp, lbs, oz).`;
  }
};

export const analyzeFridgeImage = async (base64Image: string, language: Language = 'en'): Promise<string[]> => {
  const model = "gemini-3.1-pro-preview";
  const languageInstructions = getLanguageInstructions(language);
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: `${languageInstructions}\nIdentify all visible food ingredients in this fridge. Return only a comma-separated list of ingredients in the specified language.` },
          { inlineData: { data: base64Image.split(",")[1], mimeType: "image/jpeg" } },
        ],
      },
    ],
  });

  const text = response.text || "";
  return text.split(",").map(i => i.trim()).filter(Boolean);
};

export const generateRecipes = async (ingredients: string[], dietaryRestrictions: string[], language: Language = 'en'): Promise<Recipe[]> => {
  const model = "gemini-3.1-pro-preview";
  const languageInstructions = getLanguageInstructions(language);
  
  const prompt = `${languageInstructions}
  Based on these ingredients: ${ingredients.join(", ")}, suggest 5 creative recipes. 
  Consider these dietary restrictions: ${dietaryRestrictions.join(", ")}.
  For each recipe, provide a detailed description, ingredients (mark if missing), step-by-step instructions, preparation time, difficulty, calories, dietary tags, and a rating from 1 to 5 based on its popularity and flavor profile.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: RECIPE_SCHEMA,
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse recipes", e);
    return [];
  }
};

export const generateMealPlan = async (ingredients: string[], dietaryRestrictions: string[], cuisines: string[], language: Language = 'en'): Promise<MealPlan> => {
  const model = "gemini-3.1-pro-preview";
  const languageInstructions = getLanguageInstructions(language);
  
  const prompt = `${languageInstructions}
  Generate a 7-day meal plan (Monday to Sunday) based on these available ingredients: ${ingredients.join(", ")}.
  Dietary restrictions: ${dietaryRestrictions.join(", ")}.
  Preferred cuisines: ${cuisines.join(", ")}.
  For each day, provide a breakfast, lunch, and dinner recipe.
  Each recipe must include a detailed description, ingredients, instructions, preparation time, difficulty, calories, dietary tags, and a rating.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: MEAL_PLAN_SCHEMA,
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse meal plan", e);
    return [];
  }
};

export const swapMeal = async (currentMeal: Recipe, ingredients: string[], dietaryRestrictions: string[], cuisines: string[], language: Language = 'en'): Promise<Recipe> => {
  const model = "gemini-3.1-pro-preview";
  const languageInstructions = getLanguageInstructions(language);
  
  const prompt = `${languageInstructions}
  Suggest a different recipe to replace this one: ${currentMeal.title}.
  Available ingredients: ${ingredients.join(", ")}.
  Dietary restrictions: ${dietaryRestrictions.join(", ")}.
  Preferred cuisines: ${cuisines.join(", ")}.
  Provide a detailed description, ingredients, instructions, preparation time, difficulty, calories, dietary tags, and a rating.
  Return only ONE recipe object.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: RECIPE_SCHEMA.items,
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse swapped recipe", e);
    return currentMeal;
  }
};

export const generateSpeech = async (text: string, language: Language = 'en'): Promise<string> => {
  const voiceMap = {
    'en': 'Kore',
    'ja': 'Kore', // Kore supports multiple languages or I should check if there are better ones
    'ko': 'Kore'
  };
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this cooking instruction clearly in the appropriate language: ${text}` }] }],
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
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  throw new Error("Failed to generate speech");
};
