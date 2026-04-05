import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Pause, Volume2, ChevronRight, ChevronLeft, ShoppingCart, CheckCircle2, Mic, MicOff, Clock, Flame, Star, Bookmark, RotateCcw, ChefHat, AlertCircle, Sparkles } from 'lucide-react';
import { Recipe, ShoppingItem, PantryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateSpeech } from '../services/gemini';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { checkIngredient, IngredientCheck, deductIngredients, DeductionResult, normalizeName } from '../lib/ingredientUtils';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  recipe: Recipe;
  onBack: () => void;
  onAddToShoppingList: (name: string, amount: string) => void;
  onRemoveFromShoppingList: (id: string) => void;
  shoppingList: ShoppingItem[];
  pantry: PantryItem[];
  isVoiceActive: boolean;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  onCooked: (updatedPantry: PantryItem[], recipe: Recipe) => void;
}

export const RecipeDetail: React.FC<Props> = ({ 
  recipe, 
  onBack, 
  onAddToShoppingList, 
  onRemoveFromShoppingList, 
  shoppingList, 
  pantry,
  isVoiceActive, 
  isSaved, 
  onToggleSave,
  onCooked
}) => {
  const { t, language } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [showCookedModal, setShowCookedModal] = useState(false);
  const [deductionResult, setDeductionResult] = useState<DeductionResult | null>(null);
  const [servings, setServings] = useState(() => {
    const saved = localStorage.getItem(`servings_${recipe.id}`);
    return saved ? parseInt(saved) : recipe.servings;
  });
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`adjustedAmounts_${recipe.id}`);
    if (saved) return JSON.parse(saved);
    const initial: Record<string, string> = {};
    recipe.ingredients.forEach(ing => {
      initial[ing.name] = ing.amount || '';
    });
    return initial;
  });

  useEffect(() => {
    localStorage.setItem(`adjustedAmounts_${recipe.id}`, JSON.stringify(adjustedAmounts));
  }, [adjustedAmounts, recipe.id]);

  useEffect(() => {
    localStorage.setItem(`servings_${recipe.id}`, servings.toString());
  }, [servings, recipe.id]);

  const handleAddToShoppingList = (name: string) => {
    const amount = adjustedAmounts[name];
    onAddToShoppingList(name, amount);
  };

  const resetIngredient = (name: string) => {
    const original = recipe.ingredients.find(ing => ing.name === name);
    if (original) {
      const scale = servings / recipe.servings;
      const scaled = scaleAmount(original.amount || '', scale);
      setAdjustedAmounts(prev => ({ ...prev, [name]: scaled }));
    }
  };

  const scaleAmount = (amount: string, scale: number) => {
    if (scale === 1) return amount;

    // Helper to convert decimal to fraction for common cooking measurements
    const toFraction = (decimal: number) => {
      const tolerance = 0.01;
      if (Math.abs(decimal - 0.25) < tolerance) return '1/4';
      if (Math.abs(decimal - 0.33) < tolerance) return '1/3';
      if (Math.abs(decimal - 0.5) < tolerance) return '1/2';
      if (Math.abs(decimal - 0.66) < tolerance) return '2/3';
      if (Math.abs(decimal - 0.75) < tolerance) return '3/4';
      
      const whole = Math.floor(decimal);
      const remainder = decimal - whole;
      if (remainder < tolerance) return whole.toString();
      
      return (Math.round(decimal * 100) / 100).toString();
    };

    // Handle fractions like 1/2, 3/4
    const fractionRegex = /(\d+)\/(\d+)/g;
    let processedAmount = amount.replace(fractionRegex, (_, num, den) => {
      return (parseInt(num) / parseInt(den)).toString();
    });

    // Scale all numbers (including those converted from fractions)
    processedAmount = processedAmount.replace(/(\d+(\.\d+)?)/g, (match) => {
      const num = parseFloat(match);
      const scaled = num * scale;
      return toFraction(scaled);
    });

    return processedAmount;
  };

  const handleServingsChange = (newServings: number) => {
    const scale = newServings / servings;
    setServings(newServings);
    setAdjustedAmounts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(name => {
        next[name] = scaleAmount(next[name], scale);
      });
      return next;
    });
  };

  const isIngredientAdded = (name: string) => {
    return shoppingList.some(item => item.name.toLowerCase() === name.toLowerCase());
  };

  const ingredientChecks = recipe.ingredients.map(ing => {
    const check = checkIngredient({ ...ing, amount: adjustedAmounts[ing.name] }, pantry);
    return check;
  });

  const availableCount = ingredientChecks.filter(c => c.status === 'available').length;
  const missingIngredients = ingredientChecks.filter(c => c.status === 'missing' || c.status === 'partial' || c.status === 'substitute_available' || c.status === 'can_omit');
  const rescueIngredients = ingredientChecks.filter(c => c.status === 'substitute_available' || c.status === 'can_omit');

  const addAllMissingToShoppingList = () => {
    recipe.ingredients.forEach((ing, idx) => {
      const check = ingredientChecks[idx];
      const pantryItem = pantry.find(p => {
        const pNorm = normalizeName(p.name);
        const iNorm = normalizeName(ing.name);
        return pNorm.includes(iNorm) || iNorm.includes(pNorm);
      });
      
      const isMissing = check.status === 'missing' || check.status === 'partial';
      const isLow = pantryItem?.isLowStock;

      if ((isMissing || isLow) && !isIngredientAdded(ing.name)) {
        const amountToAdd = check.status === 'partial' ? check.missingAmount || check.requiredAmount : check.requiredAmount;
        onAddToShoppingList(ing.name, amountToAdd);
      }
    });
  };

  const handleToggleIngredient = (name: string) => {
    const existing = shoppingList.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onRemoveFromShoppingList(existing.id);
    } else {
      onAddToShoppingList(name, adjustedAmounts[name]);
    }
  };

  const handleCookedClick = () => {
    const result = deductIngredients(recipe.ingredients.map(ing => ({ ...ing, amount: adjustedAmounts[ing.name] })), pantry);
    setDeductionResult(result);
    setShowCookedModal(true);
  };

  const confirmCooked = () => {
    if (deductionResult) {
      onCooked(deductionResult.updatedPantry, recipe);
      onBack();
    }
  };

  const handlePlayStep = useCallback(async () => {
    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      const audioUrl = await generateSpeech(recipe.instructions[currentStep], language);
      const newAudio = new Audio(audioUrl);
      setAudio(newAudio);
      newAudio.play();
      newAudio.onended = () => setIsPlaying(false);
    } catch (error) {
      console.error("Speech failed", error);
      setIsPlaying(false);
    }
  }, [isPlaying, audio, currentStep, recipe.instructions]);

  const nextStep = useCallback(() => {
    if (currentStep < recipe.instructions.length - 1) {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, recipe.instructions.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const voiceCommands = [
    { command: 'next', callback: nextStep },
    { command: 'back', callback: prevStep },
    { command: 'previous', callback: prevStep },
    { command: 'read', callback: handlePlayStep },
    { command: 'play', callback: handlePlayStep },
    { command: 'stop', callback: () => { audio?.pause(); setIsPlaying(false); } },
    { command: 'exit', callback: onBack },
    { command: 'close', callback: onBack },
    { 
      command: /add (.+) to shopping list/, 
      callback: (match: any) => {
        const item = match[1].toLowerCase();
        const ingredient = recipe.ingredients.find(ing => ing.name.toLowerCase().includes(item));
        if (ingredient && !isIngredientAdded(ingredient.name)) {
          handleToggleIngredient(ingredient.name);
        }
      } 
    },
    { 
      command: /remove (.+) from shopping list/, 
      callback: (match: any) => {
        const item = match[1].toLowerCase();
        const ingredient = recipe.ingredients.find(ing => ing.name.toLowerCase().includes(item));
        if (ingredient && isIngredientAdded(ingredient.name)) {
          handleToggleIngredient(ingredient.name);
        }
      } 
    },
    { 
      command: /go to step with (.+)/, 
      callback: (match: any) => {
        const item = match[1].toLowerCase();
        const stepIdx = recipe.instructions.findIndex(step => step.toLowerCase().includes(item));
        if (stepIdx !== -1) {
          setCurrentStep(stepIdx);
        }
      } 
    },
  ];

  const { isListening, error: voiceError, startListening } = useVoiceCommands(voiceCommands, isVoiceActive);

  useEffect(() => {
    return () => {
      audio?.pause();
    };
  }, [audio]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {voiceError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-3xl text-sm text-red-600 dark:text-red-400 font-medium flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <MicOff className="w-5 h-5" />
              <span>{voiceError}</span>
            </div>
            <button 
              onClick={startListening}
              className="text-red-700 dark:text-red-400 font-bold underline text-left ml-8"
            >
              {t('voice.tryAgain')}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">{t('recipes.backToRecipes')}</span>
          </button>
          
          <div className="flex items-center gap-3">
            {isVoiceActive && (
              <button 
                onClick={() => !isListening && startListening()}
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${isListening ? 'bg-orange-50 dark:bg-orange-600/10 border-orange-100 dark:border-orange-600/30 text-orange-600' : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              >
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-orange-600 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {isListening ? t('recipes.voiceControlActive') : t('recipes.clickToStartVoice')}
                </span>
                <Mic className={`w-4 h-4 ${isListening ? 'text-orange-600' : 'text-zinc-300 dark:text-zinc-700'}`} />
              </button>
            )}

            <button 
              onClick={onToggleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
                isSaved 
                  ? 'bg-orange-600 border-orange-600 text-white shadow-lg' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-orange-600 hover:text-orange-600'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isSaved ? t('recipes.saved') : t('recipes.saveRecipe')}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-orange-500">
                <Star className="w-5 h-5 fill-current" />
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{recipe.rating.toFixed(1)}</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500 font-medium ml-1">{t('recipes.averageRating')}</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setUserRating(star)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-5 h-5 ${
                        star <= (hoverRating || userRating || 0) 
                          ? 'fill-orange-500 text-orange-500' 
                          : 'text-zinc-300 dark:text-zinc-700'
                      } transition-colors`} 
                    />
                  </button>
                ))}
                {userRating && (
                  <span className="text-xs font-bold text-orange-600 ml-2 animate-pulse">{t('recipes.rated')}</span>
                )}
              </div>
            </div>
            <h1 className="text-4xl font-display font-bold text-zinc-900 dark:text-white mb-4">{recipe.title}</h1>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 dark:bg-orange-600/10 px-3 py-1.5 rounded-xl">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">{recipe.preparationTime}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-xl">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">{recipe.calories} {t('recipes.kcal')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4" />
                <span className="text-sm font-bold">{recipe.difficulty}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mb-6">
              {recipe.dietaryTags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">{recipe.description}</p>
            
            <div className="space-y-6">
              <div className="bg-orange-50 dark:bg-orange-600/5 rounded-3xl p-6 border border-orange-100 dark:border-orange-900/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white">{t('recipes.pantryCheck')}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('recipes.pantryCheckDesc', { available: availableCount, total: recipe.ingredients.length })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(availableCount / recipe.ingredients.length) * 100}%` }}
                        className="h-full bg-orange-600"
                      />
                    </div>
                    <span className="text-xs font-bold text-orange-600">
                      {Math.round((availableCount / recipe.ingredients.length) * 100)}%
                    </span>
                  </div>
                </div>

                {missingIngredients.length > 0 && (
                  <button 
                    onClick={addAllMissingToShoppingList}
                    className="w-full py-3 bg-white dark:bg-zinc-900 text-orange-600 rounded-2xl text-sm font-bold border border-orange-200 dark:border-orange-900/30 hover:bg-orange-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {t('recipes.addMissingToShopping', { count: missingIngredients.length })}
                  </button>
                )}
              </div>

              {rescueIngredients.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/10 rounded-3xl p-6 border border-green-100 dark:border-green-900/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white">{t('recipes.recipeRescue')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('recipes.smartSwaps')}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {rescueIngredients.map((check) => (
                      <div key={check.id} className="flex flex-col gap-1 p-3 bg-white dark:bg-zinc-900/50 rounded-2xl border border-green-50 dark:border-green-900/10 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{check.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-md">
                            {check.status === 'can_omit' ? t('recipes.safeToSkip') : t('recipes.swapAvailable')}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
                          {check.substitution?.note || (check.status === 'can_omit' ? t('recipes.garnishSkip') : t('recipes.useInstead', { substitute: check.substitution?.substituteIngredient }))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white">{t('recipes.ingredients')}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t('recipes.adjustQuantities')}</p>
                </div>
                
                <div className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-2">{t('recipes.servings')}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleServingsChange(Math.max(1, servings - 1))}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-zinc-900 dark:text-white text-sm">{servings}</span>
                    <button 
                      onClick={() => handleServingsChange(servings + 1)}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {recipe.ingredients.map((ing, idx) => {
                  const isAdded = isIngredientAdded(ing.name);
                  const check = ingredientChecks[idx];
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleToggleIngredient(ing.name)}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border cursor-pointer group/row ${
                        isAdded 
                          ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-orange-200 dark:hover:border-orange-900/30 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isAdded 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-zinc-200 dark:border-zinc-700 bg-transparent group-hover/row:border-orange-400'
                        }`}>
                          {isAdded && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                          <div className="relative group/input" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="text"
                          value={adjustedAmounts[ing.name] || ''}
                          onChange={(e) => setAdjustedAmounts(prev => ({ ...prev, [ing.name]: e.target.value }))}
                          className={`w-28 px-3 py-2 rounded-xl border text-sm font-bold transition-all shadow-sm ${
                            isAdded 
                              ? 'bg-green-100/50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40 text-green-700 dark:text-green-400' 
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600'
                          }`}
                          placeholder={t('recipes.qty')}
                        />
                        <button 
                          onClick={() => resetIngredient(ing.name)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-300 hover:text-orange-600 opacity-0 group-hover/input:opacity-100 transition-all bg-white dark:bg-zinc-800 rounded-lg shadow-sm"
                          title={t('recipes.resetToOriginal')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                          <div className="flex flex-col">
                            <span className={`font-medium transition-all ${isAdded ? 'text-green-700 dark:text-green-400 line-through opacity-60' : 'text-zinc-800 dark:text-zinc-200'}`}>
                              {ing.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {check.status === 'available' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {t('recipes.inPantry')}
                                  </span>
                                  {pantry.find(p => {
                                    const pNorm = normalizeName(p.name);
                                    const iNorm = normalizeName(ing.name);
                                    return pNorm.includes(iNorm) || iNorm.includes(pNorm);
                                  })?.isLowStock && (
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> {t('recipes.lowStock')}
                                    </span>
                                  )}
                                </div>
                              )}
                              {check.status === 'partial' && (
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                                  <Flame className="w-3 h-3" /> {t('recipes.lowStockQty', { qty: check.pantryAmount })}
                                </span>
                              )}
                              {check.status === 'substitute_available' && (
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> {t('recipes.useSubstitute', { substitute: check.substitution?.substituteIngredient })}
                                </span>
                              )}
                              {check.status === 'can_omit' && (
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> {t('recipes.optional')}
                                </span>
                              )}
                              {check.status === 'missing' && (
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                  {t('recipes.missing')}
                                </span>
                              )}
                              {check.status === 'unknown' && (
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider italic">
                                  {t('recipes.checkPantry', { qty: check.pantryAmount })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleIngredient(ing.name);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                          isAdded 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-orange-600 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('recipes.added')}</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4" />
                            <span>{t('recipes.add')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative aspect-square rounded-[40px] overflow-hidden shadow-2xl">
            <img 
              src={`https://picsum.photos/seed/${recipe.id}/1000/1000`} 
              alt={recipe.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="bg-zinc-900 dark:bg-zinc-900/50 rounded-[40px] p-8 md:p-12 text-white shadow-2xl overflow-hidden border border-white/5 relative">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10">
            <motion.div 
              className="h-full bg-orange-600"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / recipe.instructions.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 20 }}
            />
          </div>

          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-orange-600/20 text-orange-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-orange-600/30">
                  {t('recipes.stepXofY', { current: currentStep + 1, total: recipe.instructions.length })}
                </span>
                {currentStep === recipe.instructions.length - 1 && (
                  <span className="px-3 py-1 bg-green-600/20 text-green-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-600/30 animate-pulse">
                    {t('recipes.finalStep')}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-display font-bold">{t('recipes.cookingInstructions')}</h2>
            </div>
            <button 
              onClick={handlePlayStep}
              className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>
          </div>

          <div className="min-h-[200px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-2xl md:text-4xl font-display font-medium leading-tight text-center"
              >
                {recipe.instructions[currentStep]}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/10">
            <button 
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(s => s - 1)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="font-bold">{t('recipes.previous')}</span>
            </button>
            
            <div className="flex gap-2">
              {recipe.instructions.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-orange-500' : 'w-2 bg-white/20'}`} 
                />
              ))}
            </div>

            {currentStep === recipe.instructions.length - 1 ? (
              <button 
                onClick={handleCookedClick}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 animate-bounce"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{t('recipes.iCookedThis')}</span>
              </button>
            ) : (
              <button 
                onClick={() => setCurrentStep(s => s + 1)}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
              >
                <span className="font-bold">{t('recipes.next')}</span>
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Cooked Confirmation Modal */}
        <AnimatePresence>
          {showCookedModal && deductionResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCookedModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden"
              >
                <div className="p-8 md:p-10">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-600/10 rounded-2xl flex items-center justify-center mb-6">
                    <ChefHat className="w-8 h-8 text-orange-600" />
                  </div>
                  <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('recipes.recipeComplete')}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-8">{t('recipes.confirmDeduction')}</p>

                  <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {deductionResult.deductions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">{t('recipes.deducting')}</h4>
                        <div className="space-y-2">
                          {deductionResult.deductions.map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">{d.name}</span>
                              <div className="text-right">
                                <p className="text-xs text-zinc-400 line-through">{d.oldAmount}</p>
                                <p className="text-sm font-bold text-orange-600">{d.newAmount || t('recipes.usedUp')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deductionResult.skipped.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">{t('recipes.skipped')}</h4>
                        <div className="space-y-2">
                          {deductionResult.skipped.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 opacity-60">
                              <span className="font-medium text-zinc-500 dark:text-zinc-400">{s.name}</span>
                              <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                                {s.reason === 'incompatible_units' ? t('recipes.unitMismatch') : s.reason === 'no_quantity' ? t('recipes.noQty') : t('recipes.missingLabel')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-10">
                    <button 
                      onClick={() => setShowCookedModal(false)}
                      className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      {t('recipes.cancel')}
                    </button>
                    <button 
                      onClick={confirmCooked}
                      className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                    >
                      {t('recipes.confirm')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
