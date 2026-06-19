import React from 'react';
import { Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { Recipe, View, PantryItem } from '../types';
import { RecipeCard } from '../components/RecipeCard';
import { useI18n } from '../i18n/I18nContext';
import { getRecipeReason } from '../lib/reasonUtils';

interface Props {
  savedRecipesList: Recipe[];
  pantry: PantryItem[];
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleSave: (e: React.MouseEvent, recipeId: string) => void;
  onViewChange: (view: View) => void;
}

export const SavedView: React.FC<Props> = ({
  savedRecipesList,
  pantry,
  onSelectRecipe,
  onToggleSave,
  onViewChange,
}) => {
  const { t } = useI18n();

  return (
    <motion.div
      key="saved"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mb-10">
        <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">{t('common.saved')}</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('saved.homeSubtitle')}</p>
      </div>

      {savedRecipesList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {savedRecipesList.map((recipe) => (
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
      ) : (
        <div className="text-center py-40">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bookmark className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
          </div>
          <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('saved.emptyTitle')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">{t('saved.emptyDesc')}</p>
          <button
            type="button"
            onClick={() => onViewChange('home')}
            className="px-8 py-3 bg-zinc-900 dark:bg-orange-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-orange-500 transition-all"
          >
            {t('common.findRecipes')}
          </button>
        </div>
      )}
    </motion.div>
  );
};
