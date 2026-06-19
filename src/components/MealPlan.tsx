import React, { useEffect, useState } from 'react';
import {
  Calendar,
  RefreshCw,
  Clock,
  Flame,
  Loader2,
  Save,
  Coffee,
  Sun,
  Moon,
  AlertCircle,
  UtensilsCrossed,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MealPlan as MealPlanType, Recipe, PantryItem, Language } from '../types';
import { swapMeal } from '../services/gemini';
import { useI18n } from '../i18n/I18nContext';
import { getRecipeReason } from '../lib/reasonUtils';

interface Props {
  plan: MealPlanType;
  /** Language the cached plan was generated in. null when there's no cached plan. */
  planLanguage?: Language | null;
  ingredients: string[];
  dietaryRestrictions: string[];
  onSave: (plan: MealPlanType) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  pantry: PantryItem[];
}

export const MealPlan: React.FC<Props> = ({
  plan,
  planLanguage,
  ingredients,
  dietaryRestrictions,
  onSave,
  onSelectRecipe,
  isGenerating,
  onGenerate,
  pantry
}) => {
  const { t, language, locale } = useI18n();
  const isStaleLanguage = planLanguage != null && planLanguage !== language && plan.length > 0;
  const languageDisplay = (lang: Language) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(lang) ?? lang;
    } catch {
      return lang;
    }
  };
  const [localPlan, setLocalPlan] = useState<MealPlanType>(plan);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapErrorId, setSwapErrorId] = useState<string | null>(null);

  useEffect(() => {
    setLocalPlan(plan);
  }, [plan]);

  const handleSwap = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const currentMeal = localPlan[dayIndex][mealType];
    const mealId = `${dayIndex}-${mealType}`;
    setSwappingId(mealId);
    setSwapErrorId(null);

    try {
      const newRecipe = await swapMeal(currentMeal, ingredients, dietaryRestrictions, [], language);
      const newPlan = [...localPlan];
      newPlan[dayIndex] = { ...newPlan[dayIndex], [mealType]: newRecipe };
      setLocalPlan(newPlan);
    } catch (error) {
      console.error("Swap failed", error);
      setSwapErrorId(mealId);
      setTimeout(() => setSwapErrorId(prev => prev === mealId ? null : prev), 4000);
    } finally {
      setSwappingId(null);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-40 glass rounded-[4rem] border border-white/50 dark:border-zinc-800/50 soft-shadow glossy">
        <div className="relative mb-8">
          <Loader2 className="w-16 h-16 text-food-orange animate-spin" />
          <div className="absolute inset-0 blur-xl bg-food-orange/30 animate-pulse" />
        </div>
        <h3 className="text-4xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('mealPlan.generating')}</h3>
        <p className="text-zinc-500 text-lg font-medium">{t('mealPlan.generatingDesc')}</p>
      </div>
    );
  }

  if (localPlan.length === 0) {
    return (
      <div className="text-center py-40 glass glossy rounded-[4rem] border border-white/50 dark:border-zinc-800/50 soft-shadow">
        <div className="w-24 h-24 bg-orange-50 dark:bg-orange-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-food-orange glossy shadow-inner">
          <Calendar className="w-12 h-12" />
        </div>
        <h3 className="text-4xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('mealPlan.emptyTitle')}</h3>
        <p className="text-zinc-500 text-lg mb-10 max-w-md mx-auto font-medium">{t('mealPlan.emptyDesc')}</p>
        <button
          type="button"
          onClick={onGenerate}
          className="px-10 py-5 bg-food-orange text-white rounded-[2rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-food-orange/20 flex items-center gap-3 mx-auto glossy"
        >
          <RefreshCw className="w-6 h-6" />
          {t('mealPlan.generateButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-5xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('mealPlan.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">{t('mealPlan.subtitle')}</p>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onGenerate}
            className="px-6 py-4 glass text-zinc-600 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center gap-3 glossy"
          >
            <RefreshCw className="w-5 h-5" />
            {t('mealPlan.regenerate')}
          </button>
          <button
            type="button"
            onClick={() => onSave(localPlan)}
            className="px-8 py-4 bg-food-orange text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-3 shadow-xl shadow-food-orange/20 glossy"
          >
            <Save className="w-5 h-5" />
            {t('mealPlan.savePlan')}
          </button>
        </div>
      </div>

      {isStaleLanguage && planLanguage && (
        <div className="flex items-start gap-4 p-6 glass glossy soft-shadow rounded-[2rem] border border-food-orange/30 bg-food-orange/5">
          <AlertCircle className="w-6 h-6 text-food-orange shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-display font-black text-zinc-900 dark:text-white tracking-tight">
              {t('mealPlan.staleLanguageTitle', { planLang: languageDisplay(planLanguage) })}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {t('mealPlan.staleLanguageHint', { currentLang: languageDisplay(language) })}
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            className="px-5 py-2.5 bg-food-orange text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md glossy shrink-0"
          >
            {t('mealPlan.regenerate')}
          </button>
        </div>
      )}

      <div className="grid gap-12">
        {localPlan.map((dayPlan, dayIdx) => (
          <motion.div
            key={dayPlan.day}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIdx * 0.1 }}
            className="glass glossy rounded-[3rem] border border-white/50 dark:border-zinc-800/50 shadow-xl overflow-hidden"
          >
            <div className="bg-white/40 dark:bg-zinc-900/40 px-10 py-6 border-b border-white/50 dark:border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{dayPlan.day}</h3>
              <div className="px-5 py-2 glass rounded-full text-[10px] font-black text-food-orange uppercase tracking-[0.2em] glossy">
                {t('mealPlan.totalKcal', { total: dayPlan.breakfast.calories + dayPlan.lunch.calories + dayPlan.dinner.calories })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/50 dark:divide-zinc-800/50">
              {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
                const recipe = dayPlan[mealType];
                const mealId = `${dayIdx}-${mealType}`;
                const isSwapping = swappingId === mealId;
                const hasSwapError = swapErrorId === mealId;
                const Icon = mealType === 'breakfast' ? Coffee : mealType === 'lunch' ? Sun : Moon;
                const reasonKey = getRecipeReason(recipe, pantry);
                const reason = t(reasonKey);

                return (
                  <div key={mealType} className="p-8 group relative flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3 text-food-orange">
                        <div className="w-10 h-10 bg-food-orange/20 rounded-xl flex items-center justify-center glossy">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em]">{t(`mealPlan.${mealType}`)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasSwapError && (
                          <span
                            className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest"
                            title={t('mealPlan.swapFailedFor', { meal: recipe.title })}
                            aria-label={t('mealPlan.swapFailedFor', { meal: recipe.title })}
                          >
                            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span aria-hidden="true">{t('mealPlan.swapFailed')}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSwap(dayIdx, mealType)}
                          disabled={isSwapping || !!swappingId}
                          aria-label={t('mealPlan.swapMeal', { meal: t(`mealPlan.${mealType}`) })}
                          className={`p-3 glass rounded-xl transition-all disabled:opacity-50 glossy ${hasSwapError ? 'text-red-400 hover:text-red-500' : 'text-zinc-400 hover:text-food-orange'}`}
                        >
                          <RefreshCw className={`w-5 h-5 ${isSwapping ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cursor-pointer flex-1 flex flex-col text-left"
                      onClick={() => onSelectRecipe(recipe)}
                      aria-label={t('mealPlan.openMeal', { title: recipe.title })}
                    >
                      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-6 soft-shadow group-hover:scale-105 transition-transform duration-500 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-zinc-800 dark:to-zinc-900">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <UtensilsCrossed className="w-14 h-14 text-food-orange/30" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-tighter">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{recipe.preparationTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              <span>{recipe.calories}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {recipe.styleNote && (
                          <p className="text-[10px] font-black text-food-orange uppercase tracking-[0.2em] opacity-80">
                            {recipe.styleNote}
                          </p>
                        )}
                        <h4 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter group-hover:text-food-orange transition-colors line-clamp-2 leading-tight">
                          {recipe.title}
                        </h4>
                        {reason && (
                          <p className="text-sm font-medium text-zinc-500 line-clamp-2 leading-relaxed italic">
                            "{reason}"
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-6">
                        {recipe.dietaryTags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-3 py-1 glass rounded-full text-[10px] font-black text-zinc-400 uppercase tracking-widest glossy">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
