import React from 'react';
import { Search, Leaf, Flame, Sparkles, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Recipe, View, PantryItem } from '../types';
import { RecipeCard } from '../components/RecipeCard';
import { useI18n } from '../i18n/I18nContext';
import { getRecipeReason } from '../lib/reasonUtils';

const DIETARY_FILTERS = [
  { id: 'vegetarian', icon: Leaf },
  { id: 'keto', icon: Flame },
  { id: 'vegan', icon: Sparkles },
  { id: 'gluten-free', icon: Zap },
] as const;

interface Props {
  filteredRecipes: Recipe[];
  pantry: PantryItem[];
  activeFilters: string[];
  savedRecipes: string[];
  onToggleFilter: (id: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleSave: (e: React.MouseEvent, recipeId: string) => void;
  onViewChange: (view: View) => void;
}

export const RecipesView: React.FC<Props> = ({
  filteredRecipes,
  pantry,
  activeFilters,
  savedRecipes,
  onToggleFilter,
  onSelectRecipe,
  onToggleSave,
  onViewChange,
}) => {
  const { t } = useI18n();

  return (
    <motion.div
      key="recipes"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">{t('recipes.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('recipes.subtitle', { count: pantry.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl">
            {DIETARY_FILTERS.map(filter => (
              <button
                type="button"
                key={filter.id}
                onClick={() => onToggleFilter(filter.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilters.includes(filter.id) ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              >
                {t(`filters.${filter.id.replace('-f', 'F')}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredRecipes.map((recipe) => (
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
      ) : (
        <div className="text-center py-40">
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">{t('recipes.noRecipes')}</h3>
          <p className="text-zinc-500 mb-8">{t('recipes.noRecipesDesc')}</p>
          <button
            type="button"
            onClick={() => onViewChange('home')}
            className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
          >
            {t('common.scanFridge')}
          </button>
        </div>
      )}
    </motion.div>
  );
};
