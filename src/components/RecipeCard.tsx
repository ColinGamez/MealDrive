import React from 'react';
import { Clock, Flame, Star, Sparkles, Bookmark, CheckCircle2, UtensilsCrossed, History, Globe2 } from 'lucide-react';
import { Recipe } from '../types';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

/** Stable status keys; UI text comes from i18n via `statusLabel.*`. */
export type RecipeCardStatus = 'readyToCook' | 'cookWithSwaps' | 'almostThere' | 'missing';

interface Props {
  recipe: Recipe;
  onClick: () => void;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  /** When set, renders a colored status pill in the corner of the card. */
  status?: RecipeCardStatus;
  /** Optional override label (e.g. "Missing 3"). Defaults to a localized status string. */
  statusOverride?: string;
  rescueMessage?: string;
  reason?: string;
  /** Epoch ms — when set, renders a "cooked X ago" badge. */
  cookedAt?: number;
}

function formatCookedAgo(cookedAt: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = cookedAt - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

export const RecipeCard: React.FC<Props> = React.memo(({
  recipe,
  onClick,
  isSaved,
  onToggleSave,
  status,
  statusOverride,
  rescueMessage,
  reason,
  cookedAt,
}) => {
  const { t, locale, language } = useI18n();
  const cookedAgo = cookedAt ? formatCookedAgo(cookedAt, locale) : null;
  const isMismatchedLanguage = !!recipe.language && recipe.language !== language;
  const recipeLangDisplay = isMismatchedLanguage && recipe.language
    ? (() => {
        try {
          return new Intl.DisplayNames([locale], { type: 'language' }).of(recipe.language) ?? recipe.language;
        } catch {
          return recipe.language;
        }
      })()
    : null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      whileHover={{ y: -12, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="glass glossy soft-shadow rounded-[3rem] overflow-hidden transition-all cursor-pointer group relative"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={t('recipes.openRecipe', { title: recipe.title })}
    >
      <div className="aspect-[4/5] relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-zinc-800 dark:to-zinc-900">
        <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-1000 ease-out">
          <UtensilsCrossed className="w-24 h-24 text-food-orange/30" />
        </div>

        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              {recipe.id.startsWith('featured-') && (
                <span className="px-4 py-1.5 bg-food-orange text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 w-fit glossy">
                  <Star className="w-3 h-3 fill-current" />
                  {t('recipes.featured')}
                </span>
              )}
              {recipe.rating >= 4.8 && (
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-xl text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 w-fit glossy">
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  {t('recipes.topRated')}
                </span>
              )}
              {cookedAgo && (
                <span className="px-4 py-1.5 bg-black/40 backdrop-blur-xl text-white border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 w-fit glossy">
                  <History className="w-3 h-3" />
                  {t('recipes.cookedAgo', { ago: cookedAgo })}
                </span>
              )}
              {recipeLangDisplay && (
                <span
                  className="px-4 py-1.5 bg-black/40 backdrop-blur-xl text-white border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 w-fit glossy"
                  title={t('recipes.languageMismatchHint', { lang: recipeLangDisplay })}
                >
                  <Globe2 className="w-3 h-3" />
                  {recipeLangDisplay}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSave?.(e); }}
              aria-label={isSaved ? t('recipes.removeSavedRecipe') : t('recipes.saveRecipe')}
              className={`p-4 rounded-[1.5rem] backdrop-blur-2xl transition-all shadow-2xl z-10 glossy border border-white/30 ${
                isSaved
                  ? 'bg-food-orange text-white'
                  : 'bg-white/10 text-white hover:bg-white/30'
              }`}
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {recipe.dietaryTags.slice(0, 2).map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg">
                  {tag}
                </span>
              ))}
              {status && (() => {
                const positive = status === 'readyToCook' || status === 'cookWithSwaps';
                const label = statusOverride ?? t(`statusLabel.${status}`);
                return (
                  <span
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 w-fit glossy ${
                      positive ? 'bg-fresh-green text-zinc-900' : 'bg-food-orange text-white'
                    }`}
                  >
                    {positive ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    {label}
                  </span>
                );
              })()}
            </div>

            <div className="space-y-2">
              {recipe.styleNote && (
                <p className="text-[10px] font-black text-food-coral uppercase tracking-[0.3em] drop-shadow-2xl">
                  {recipe.styleNote}
                </p>
              )}
              <h3 className="text-3xl font-display font-black text-white leading-none tracking-tighter drop-shadow-2xl group-hover:text-glow transition-all">
                {recipe.title}
              </h3>
              <div className="flex items-center gap-6 text-white/90 text-xs font-black uppercase tracking-widest pt-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-blue" />
                  <span>{recipe.preparationTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-food-orange" />
                  <span>{recipe.calories} kcal</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span>{recipe.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(reason || rescueMessage) && (
        <div className="p-5 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl border-t border-white/20 dark:border-zinc-800/20 glossy">
          <p className="text-[11px] font-black text-zinc-600 dark:text-zinc-400 flex items-center gap-3 uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-food-orange animate-pulse" />
            <span className="line-clamp-1">{rescueMessage || reason}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
});
