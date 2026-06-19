import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, User, Smile, ChefHat, Utensils } from 'lucide-react';
import { UserProfile } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface ProfileEditProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['👨‍🍳', '👩‍🍳', '🧑‍🍳', '🍳', '🥘', '🥗', '🍱', '🍜', '🍕', '🍔', '🌮', '🥑', '🥦', '🍓', '🍰', '☕'];
// Stored ids are stable English strings (backwards-compatible with existing
// profile data). Display labels come from i18n.
export const STYLE_OPTIONS = ['Quick Meals', 'Healthy', 'Comfort Food', 'Gourmet', 'Budget Friendly', 'Family Style'] as const;
export const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten Free', 'Keto', 'Dairy Free', 'Nut Free'] as const;
const STYLE_LABEL_KEYS: Record<string, string> = {
  'Quick Meals': 'profile.styles.quickMeals',
  'Healthy': 'profile.styles.healthy',
  'Comfort Food': 'profile.styles.comfortFood',
  'Gourmet': 'profile.styles.gourmet',
  'Budget Friendly': 'profile.styles.budgetFriendly',
  'Family Style': 'profile.styles.familyStyle',
};
const DIETARY_LABEL_KEYS: Record<string, string> = {
  'Vegetarian': 'profile.diets.vegetarian',
  'Vegan': 'profile.diets.vegan',
  'Gluten Free': 'profile.diets.glutenFree',
  'Keto': 'profile.diets.keto',
  'Dairy Free': 'profile.diets.dairyFree',
  'Nut Free': 'profile.diets.nutFree',
};
export const styleLabelKey = (id: string): string | null => STYLE_LABEL_KEYS[id] ?? null;
export const dietaryLabelKey = (id: string): string | null => DIETARY_LABEL_KEYS[id] ?? null;

export const ProfileEdit: React.FC<ProfileEditProps> = ({ profile, onSave, onCancel }) => {
  const { t } = useI18n();
  const [edited, setEdited] = useState<UserProfile>({ ...profile });

  // Close on Escape — standard a11y expectation for dialogs.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/60 backdrop-blur-md"
      onClick={onCancel}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('profile.edit')}
        className="glass glossy w-full max-w-xl rounded-[4rem] shadow-2xl border border-white/50 dark:border-zinc-800/50 overflow-hidden soft-shadow"
      >
        {/* Glossy Reflection */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="p-12 space-y-10 relative z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-4xl font-display font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
              {t('profile.edit')}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('common.dismiss')}
              className="p-3 glass glossy rounded-full text-zinc-400 hover:text-food-orange transition-all"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
            {/* Display Name */}
            <div className="space-y-4">
              <label htmlFor="profile-display-name" className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                <User className="w-4 h-4" />
                {t('profile.displayName')}
              </label>
              <input
                id="profile-display-name"
                type="text"
                value={edited.displayName}
                onChange={(e) => setEdited({ ...edited, displayName: e.target.value })}
                className="w-full px-8 py-5 glass glossy bg-white/50 dark:bg-zinc-800/50 border-2 border-transparent rounded-[2rem] text-xl font-display font-bold focus:border-food-orange transition-all dark:text-white placeholder:text-zinc-300"
                placeholder={t('profile.namePlaceholder')}
              />
            </div>

            {/* Avatar Emoji */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                <Smile className="w-4 h-4" />
                {t('profile.avatar')}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setEdited({ ...edited, emojiAvatar: emoji })}
                    aria-pressed={edited.emojiAvatar === emoji}
                    className={`aspect-square flex items-center justify-center rounded-2xl text-2xl transition-all glossy shadow-inner ${edited.emojiAvatar === emoji ? 'bg-food-orange scale-110 shadow-xl shadow-food-orange/30' : 'glass bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Cooking Style */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                <ChefHat className="w-4 h-4" />
                {t('profile.style')}
              </label>
              <div className="flex flex-wrap gap-3">
                {STYLE_OPTIONS.map(style => {
                  const labelKey = styleLabelKey(style);
                  return (
                    <button
                      type="button"
                      key={style}
                      onClick={() => setEdited({ ...edited, cookingStyle: style })}
                      aria-pressed={edited.cookingStyle === style}
                      className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all glossy ${edited.cookingStyle === style ? 'bg-food-orange text-white shadow-xl shadow-food-orange/30' : 'glass bg-white/50 dark:bg-zinc-800/50 text-zinc-500 hover:bg-white dark:hover:bg-zinc-700'}`}
                    >
                      {labelKey ? t(labelKey) : style}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dietary Needs */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                <Utensils className="w-4 h-4" />
                {t('profile.dietary')}
              </label>
              <div className="flex flex-wrap gap-3">
                {DIETARY_OPTIONS.map(diet => {
                  const labelKey = dietaryLabelKey(diet);
                  return (
                    <button
                      type="button"
                      key={diet}
                      onClick={() => {
                        const current = edited.dietaryPreferences;
                        const next = current.includes(diet) ? current.filter(d => d !== diet) : [...current, diet];
                        setEdited({ ...edited, dietaryPreferences: next });
                      }}
                      aria-pressed={edited.dietaryPreferences.includes(diet)}
                      className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all glossy ${edited.dietaryPreferences.includes(diet) ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'glass bg-white/50 dark:bg-zinc-800/50 text-zinc-500 hover:bg-white dark:hover:bg-zinc-700'}`}
                    >
                      {labelKey ? t(labelKey) : diet}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-6 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-8 py-5 glass glossy text-zinc-500 font-black uppercase tracking-widest rounded-[2rem] hover:bg-zinc-100 transition-all"
            >
              {t('profile.cancel')}
            </button>
            <button
              type="button"
              onClick={() => onSave(edited)}
              className="flex-[2] flex items-center justify-center gap-3 px-8 py-5 bg-food-orange text-white font-black uppercase tracking-widest rounded-[2rem] hover:scale-105 shadow-2xl shadow-food-orange/30 transition-all glossy"
            >
              <Save className="w-6 h-6" />
              {t('profile.save')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
