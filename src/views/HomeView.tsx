import React from 'react';
import {
  Calendar,
  ChevronRight,
  Sparkles,
  Plus,
  ScanLine,
  Refrigerator,
  UtensilsCrossed,
  Leaf,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  Recipe,
  PantryItem,
  RecentRecipe,
  View,
} from '../types';
import { RecipeCard } from '../components/RecipeCard';
import { IngredientScanner } from '../components/IngredientScanner';
import { useI18n } from '../i18n/I18nContext';
import { getRecipePantryStatus } from '../lib/ingredientUtils';
import { getRecipeReason } from '../lib/reasonUtils';
import { getPantryFreshness } from '../lib/pantryUtils';

interface Props {
  pantry: PantryItem[];
  recipes: Recipe[];
  featuredRecipes: Recipe[];
  canMakeNowRecipes: Recipe[];
  almostThereRecipes: Recipe[];
  cookWithSwapsRecipes: Recipe[];
  savedRecipesList: Recipe[];
  savedRecipes: string[];
  recentHistory: RecentRecipe[];
  isAnalyzing: boolean;
  onScan: (images: string[]) => Promise<void> | void;
  onGenerateFromPantry: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleSave: (e: React.MouseEvent, recipeId: string) => void;
  onViewChange: (view: View) => void;
}

export const HomeView: React.FC<Props> = ({
  pantry,
  recipes,
  featuredRecipes,
  canMakeNowRecipes,
  almostThereRecipes,
  cookWithSwapsRecipes,
  savedRecipesList,
  savedRecipes,
  recentHistory,
  isAnalyzing,
  onScan,
  onGenerateFromPantry,
  onSelectRecipe,
  onToggleSave,
  onViewChange,
}) => {
  const { t } = useI18n();
  const lowStockCount = pantry.reduce((count, item) => count + (item.isLowStock ? 1 : 0), 0);
  const useSoonCount = pantry.reduce((count, item) => {
    const status = getPantryFreshness(item).status;
    return count + (status === 'expired' || status === 'useSoon' ? 1 : 0);
  }, 0);

  const scrollToScanner = () => {
    document.getElementById('fridge-scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const quickActions = [
    {
      key: 'scan',
      icon: ScanLine,
      title: t('common.scanFridge'),
      hint: t('dashboard.scanHint'),
      action: scrollToScanner,
      tone: 'bg-orange-50 text-food-orange dark:bg-orange-500/10',
    },
    {
      key: 'pantry',
      icon: Plus,
      title: t('common.addIngredients'),
      hint: t('dashboard.pantryHint'),
      action: () => onViewChange('pantry'),
      tone: 'bg-green-50 text-green-600 dark:bg-green-500/10',
    },
    {
      key: 'recipes',
      icon: UtensilsCrossed,
      title: t('common.recipes'),
      hint: t('dashboard.recipesHint'),
      action: () => onViewChange('recipes'),
      tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10',
    },
    {
      key: 'plan',
      icon: Calendar,
      title: t('common.mealPlan'),
      hint: t('dashboard.planHint'),
      action: () => onViewChange('meal-plan'),
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
    },
  ];

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto pt-4 sm:pt-6 lg:pt-8 overflow-x-clip"
    >
      <section className="relative isolate overflow-hidden bg-white px-1 py-10 sm:rounded-[1.75rem] sm:border sm:border-orange-100 sm:bg-[#fff9f6] sm:px-10 sm:py-14 lg:min-h-[370px] lg:px-16 lg:py-16 dark:bg-zinc-950 sm:dark:border-orange-500/10 sm:dark:bg-zinc-900">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden bg-cover bg-center sm:block dark:opacity-30"
          style={{ backgroundImage: "url('/assets/mealdrive-hero-kitchen.jpg')" }}
        />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-display text-5xl font-black leading-[0.95] tracking-[-0.055em] text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white">
            {t('onboarding.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base font-medium leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            {t('dashboard.heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={scrollToScanner}
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-food-orange px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600"
            >
              <ScanLine className="h-5 w-5" />
              {t('common.scanFridge')}
            </button>
            <button
              type="button"
              onClick={() => onViewChange('pantry')}
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-extrabold text-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-food-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <Plus className="h-5 w-5" />
              {t('common.addIngredients')}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="kitchen-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 id="kitchen-heading" className="font-display text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
            {t('dashboard.yourKitchen')}
          </h3>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">
            <Leaf className="h-4 w-4 text-green-500" />
            {t('dashboard.ingredientsCount', { count: pantry.length })}
          </div>
        </div>

        {pantry.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-[1.5rem] border border-dashed border-orange-200 bg-white px-6 py-8 text-center sm:flex-row sm:px-9 sm:text-left dark:border-orange-500/20 dark:bg-zinc-900">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-food-orange dark:bg-orange-500/10">
              <Refrigerator className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-display text-xl font-black text-zinc-950 dark:text-white">{t('dashboard.pantryReady')}</h4>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t('dashboard.pantryReadyDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => onViewChange('pantry')}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-food-orange px-5 py-3 text-sm font-extrabold text-white transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              {t('common.addIngredients')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onViewChange('pantry')}
            className="flex w-full items-center gap-5 rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-6 text-left transition hover:border-orange-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600 dark:bg-green-500/10">
              <Refrigerator className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-black text-zinc-950 dark:text-white">{t('pantry.inStockTitle')}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('dashboard.ingredientsCount', { count: pantry.length })}
                {useSoonCount > 0 ? ` · ${useSoonCount} ${t('common.useSoon').toLowerCase()}` : ''}
                {lowStockCount > 0 ? ` · ${lowStockCount} ${t('common.lowStock').toLowerCase()}` : ''}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
          </button>
        )}
      </section>

      <section className="mt-8" aria-labelledby="quick-start-heading">
        <h3 id="quick-start-heading" className="mb-4 font-display text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
          {t('dashboard.quickStart')}
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((action) => (
            <button
              type="button"
              key={action.key}
              onClick={action.action}
              className="group rounded-[1.25rem] border border-zinc-200 bg-white p-4 text-left transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${action.tone}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{action.title}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{action.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <div id="fridge-scanner" className="mt-10 scroll-mt-28">
        <IngredientScanner onScan={onScan} isAnalyzing={isAnalyzing} />
      </div>

      <div className="mt-16 content-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.topRated')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.popularChoices')}</p>
          </div>
          <button
            type="button"
            onClick={() => onViewChange('recipes')}
            className="text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors flex items-center gap-1 group"
          >
            {t('common.findRecipes')}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => onSelectRecipe(recipe)}
              isSaved={savedRecipes.includes(recipe.id)}
              onToggleSave={(e) => onToggleSave(e, recipe.id)}
              reason={t(getRecipeReason(recipe, pantry))}
            />
          ))}
        </div>
      </div>

      {/* Can Make Now */}
      {(canMakeNowRecipes.length > 0 || cookWithSwapsRecipes.length > 0) ? (
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.readyToCookTitle')}</h3>
              <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.readyToCookSubtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {canMakeNowRecipes.slice(0, 3).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => onSelectRecipe(recipe)}
                isSaved={savedRecipes.includes(recipe.id)}
                onToggleSave={(e) => onToggleSave(e, recipe.id)}
                status="readyToCook"
                reason={t(getRecipeReason(recipe, pantry))}
              />
            ))}
            {cookWithSwapsRecipes.slice(0, Math.max(0, 3 - canMakeNowRecipes.length)).map((recipe) => {
              const recipeStatus = getRecipePantryStatus(recipe, pantry);
              const rescue = recipeStatus.rescueMessage;
              return (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => onSelectRecipe(recipe)}
                  isSaved={savedRecipes.includes(recipe.id)}
                  onToggleSave={(e) => onToggleSave(e, recipe.id)}
                  status="cookWithSwaps"
                  rescueMessage={rescue ? t(rescue.key, rescue.params) : undefined}
                  reason={t(getRecipeReason(recipe, pantry))}
                />
              );
            })}
          </div>
        </div>
      ) : pantry.length > 0 && (
        <div className="mt-24 p-12 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('dashboard.noRecipesReady')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">{t('dashboard.noRecipesAlmost')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onViewChange('pantry')}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
            >
              {t('common.pantry')}
            </button>
            <button
              type="button"
              onClick={onGenerateFromPantry}
              className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
            >
              {t('common.findRecipes')}
            </button>
          </div>
        </div>
      )}

      {/* Almost There */}
      {almostThereRecipes.length > 0 ? (
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.almostThereTitle')}</h3>
              <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.almostThereSubtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {almostThereRecipes.slice(0, 3).map((recipe) => {
              const recipeStatus = getRecipePantryStatus(recipe, pantry);
              const label = `${t('common.missing')} ${recipeStatus.missingCount + recipeStatus.partialCount}`;
              const rescue = recipeStatus.rescueMessage;
              return (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => onSelectRecipe(recipe)}
                  isSaved={savedRecipes.includes(recipe.id)}
                  onToggleSave={(e) => onToggleSave(e, recipe.id)}
                  status="almostThere"
                  statusOverride={label}
                  rescueMessage={rescue ? t(rescue.key, rescue.params) : undefined}
                  reason={t(getRecipeReason(recipe, pantry))}
                />
              );
            })}
          </div>
        </div>
      ) : pantry.length > 0 && recipes.length > 0 && (
        <div className="mt-24 p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-[32px] border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-zinc-500 dark:text-zinc-400 font-medium italic">{t('common.keepAdding')}</p>
        </div>
      )}

      {/* Saved Recipes */}
      {savedRecipesList.length > 0 && (
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('common.favorites')}</h3>
              <p className="text-zinc-500 dark:text-zinc-400">{t('saved.homeSubtitle')}</p>
            </div>
            <button type="button" onClick={() => onViewChange('saved')} className="text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors flex items-center gap-1 group">
              {t('common.findRecipes')} <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {savedRecipesList.slice(0, 3).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => onSelectRecipe(recipe)}
                isSaved={true}
                onToggleSave={(e) => onToggleSave(e, recipe.id)}
                reason={t(getRecipeReason(recipe, pantry))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Cooked */}
      {recentHistory.length > 0 && (
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.cookedRecently')}</h3>
              <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.revisitMeals')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recentHistory.slice(0, 3).map(({ recipe, cookedAt }) => (
              <RecipeCard
                key={`${recipe.id}-${cookedAt}`}
                recipe={recipe}
                onClick={() => onSelectRecipe(recipe)}
                isSaved={savedRecipes.includes(recipe.id)}
                onToggleSave={(e) => onToggleSave(e, recipe.id)}
                reason={t(getRecipeReason(recipe, pantry))}
                cookedAt={cookedAt}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
