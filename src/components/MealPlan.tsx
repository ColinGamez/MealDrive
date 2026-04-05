import React, { useState } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  Clock, 
  Flame, 
  Loader2, 
  Save,
  Coffee,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MealPlan as MealPlanType, Recipe } from '../types';
import { swapMeal } from '../services/gemini';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  plan: MealPlanType;
  ingredients: string[];
  dietaryRestrictions: string[];
  onSave: (plan: MealPlanType) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const MealPlan: React.FC<Props> = ({ 
  plan, 
  ingredients, 
  dietaryRestrictions, 
  onSave, 
  onSelectRecipe,
  isGenerating,
  onGenerate
}) => {
  const { t, language } = useI18n();
  const [localPlan, setLocalPlan] = useState<MealPlanType>(plan);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  const handleSwap = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const currentMeal = localPlan[dayIndex][mealType];
    const mealId = `${dayIndex}-${mealType}`;
    setSwappingId(mealId);

    try {
      const newRecipe = await swapMeal(currentMeal, ingredients, dietaryRestrictions, [], language);
      const newPlan = [...localPlan];
      newPlan[dayIndex] = { ...newPlan[dayIndex], [mealType]: newRecipe };
      setLocalPlan(newPlan);
    } catch (error) {
      console.error("Swap failed", error);
    } finally {
      setSwappingId(null);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-6" />
        <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">{t('mealPlan.generating')}</h3>
        <p className="text-zinc-500">{t('mealPlan.generatingDesc')}</p>
      </div>
    );
  }

  if (localPlan.length === 0) {
    return (
      <div className="text-center py-40 bg-white rounded-[40px] border border-zinc-100 shadow-sm">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Calendar className="w-10 h-10 text-orange-600" />
        </div>
        <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">{t('mealPlan.emptyTitle')}</h3>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">{t('mealPlan.emptyDesc')}</p>
        <button 
          onClick={onGenerate}
          className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-5 h-5" />
          {t('mealPlan.generateButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-zinc-900">{t('mealPlan.title')}</h2>
          <p className="text-zinc-500">{t('mealPlan.subtitle')}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onGenerate}
            className="px-6 py-3 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('mealPlan.regenerate')}
          </button>
          <button 
            onClick={() => onSave(localPlan)}
            className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all flex items-center gap-2 shadow-lg shadow-orange-600/20"
          >
            <Save className="w-4 h-4" />
            {t('mealPlan.savePlan')}
          </button>
        </div>
      </div>

      <div className="grid gap-8">
        {localPlan.map((dayPlan, dayIdx) => (
          <motion.div 
            key={dayPlan.day}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIdx * 0.1 }}
            className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden"
          >
            <div className="bg-zinc-50 px-8 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-zinc-900">{dayPlan.day}</h3>
              <div className="flex gap-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                <span>{t('mealPlan.totalKcal', { total: dayPlan.breakfast.calories + dayPlan.lunch.calories + dayPlan.dinner.calories })}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
              {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
                const recipe = dayPlan[mealType];
                const mealId = `${dayIdx}-${mealType}`;
                const isSwapping = swappingId === mealId;
                const Icon = mealType === 'breakfast' ? Coffee : mealType === 'lunch' ? Sun : Moon;

                return (
                  <div key={mealType} className="p-6 group relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-orange-600">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t(`mealPlan.${mealType}`)}</span>
                      </div>
                      <button 
                        onClick={() => handleSwap(dayIdx, mealType)}
                        disabled={isSwapping}
                        className="p-2 text-zinc-300 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSwapping ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div 
                      className="cursor-pointer"
                      onClick={() => onSelectRecipe(recipe)}
                    >
                      <h4 className="text-lg font-display font-bold text-zinc-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {recipe.title}
                      </h4>
                      <div className="flex items-center gap-4 text-zinc-500 text-xs mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{recipe.preparationTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          <span>{recipe.calories} {t('recipes.kcal')}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recipe.dietaryTags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-zinc-100 rounded-md text-[10px] font-bold text-zinc-500 uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
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
