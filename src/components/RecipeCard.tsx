import React from 'react';
import { Clock, Flame, ChevronRight, Star, Sparkles, Leaf, Bookmark, CheckCircle2 } from 'lucide-react';
import { Recipe } from '../types';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  recipe: Recipe;
  onClick: () => void;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  statusLabel?: string;
  cookedAt?: number;
  rescueMessage?: string;
}

export const RecipeCard: React.FC<Props> = ({ recipe, onClick, isSaved, onToggleSave, statusLabel, cookedAt, rescueMessage }) => {
  const { t } = useI18n();

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-xl transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img 
          src={`https://picsum.photos/seed/${recipe.id}/800/600`} 
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {recipe.id.startsWith('featured-') && (
            <span className="px-3 py-1 bg-zinc-900 dark:bg-orange-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit">
              <Star className="w-3 h-3 fill-current" />
              {t('recipes.featured')}
            </span>
          )}
          {recipe.rating >= 4.8 && (
            <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit">
              <Sparkles className="w-3 h-3" />
              {t('recipes.topRated')}
            </span>
          )}
          {recipe.dietaryTags.includes('Seasonal') && (
            <span className="px-3 py-1 bg-green-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit">
              <Leaf className="w-3 h-3" />
              {t('recipes.seasonal')}
            </span>
          )}
          {statusLabel && (
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit ${
              statusLabel === 'Ready to Cook' || statusLabel === 'Cook with Swaps' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'
            }`}>
              {statusLabel === 'Ready to Cook' || statusLabel === 'Cook with Swaps' ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {t(`dashboard.${statusLabel.toLowerCase().replace(/\s+/g, '')}`)}
            </span>
          )}
          {rescueMessage && !statusLabel && (
            <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit">
              <Sparkles className="w-3 h-3" />
              {rescueMessage}
            </span>
          )}
          {rescueMessage && statusLabel && (
            <div className="mt-1 px-3 py-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full text-[10px] font-bold text-orange-600 border border-orange-100 dark:border-orange-900/50 flex items-center gap-1 w-fit shadow-sm">
              <Sparkles className="w-3 h-3" />
              {rescueMessage}
            </div>
          )}
          {cookedAt && (
            <span className="px-3 py-1 bg-zinc-900/80 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 w-fit backdrop-blur-sm">
              <Clock className="w-3 h-3" />
              {t('recipes.cookedOn', { date: new Date(cookedAt).toLocaleDateString() })}
            </span>
          )}
          <div className="flex gap-2">
            {recipe.dietaryTags.slice(0, 2).map(tag => (
              <span key={tag} className="px-3 py-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
        
        <button 
          onClick={onToggleSave}
          className={`absolute top-4 right-4 p-2 rounded-full backdrop-blur-md transition-all shadow-lg z-10 ${
            isSaved 
              ? 'bg-orange-600 text-white' 
              : 'bg-white/90 dark:bg-zinc-900/90 text-zinc-400 hover:text-orange-600'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>
      
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-orange-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-bold text-zinc-900 dark:text-white">{recipe.rating.toFixed(1)}</span>
          </div>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{recipe.difficulty}</span>
        </div>
        
        <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2 line-clamp-1">{recipe.title}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 line-clamp-2 leading-relaxed">{recipe.description}</p>
        
        <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">{recipe.preparationTime}</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">{recipe.calories} kcal</span>
            </div>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
