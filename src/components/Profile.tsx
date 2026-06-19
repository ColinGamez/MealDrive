import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Trophy,
  Flame,
  Calendar,
  ShoppingBag,
  Search,
  LifeBuoy,
  Settings,
  Edit3,
  ChefHat,
  History
} from 'lucide-react';
import { UserProfile, UserStats } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { getKitchenIdentity } from '../lib/progressionUtils';
import { styleLabelKey, dietaryLabelKey } from './ProfileEdit';
import { DataBackup } from './DataBackup';

interface ProfileProps {
  profile: UserProfile;
  stats: UserStats;
  onEdit: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ profile, stats, onEdit }) => {
  const { t, language } = useI18n();
  const identity = useMemo(() => getKitchenIdentity(stats, language), [stats, language]);

  const statCards = useMemo(() => [
    { label: t('profile.totalCooked'), value: stats.totalCooked, unit: t('profile.meals'), icon: ChefHat, color: 'text-food-orange', bg: 'bg-food-orange/10' },
    { label: t('profile.streak'), value: stats.streak, unit: t('profile.days'), icon: Flame, color: 'text-food-coral', bg: 'bg-food-coral/10' },
    { label: t('profile.weeklyCooked'), value: stats.weeklyCooked, unit: t('profile.meals'), icon: Calendar, color: 'text-sky-blue', bg: 'bg-sky-blue/10' },
    { label: t('profile.scans'), value: stats.scansCompleted, unit: '', icon: Search, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: t('profile.rescues'), value: stats.rescueCount, unit: '', icon: LifeBuoy, color: 'text-fresh-green', bg: 'bg-fresh-green/10' },
    { label: t('profile.shoppingUses'), value: stats.shoppingListUses, unit: '', icon: ShoppingBag, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  ], [t, stats]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-12 space-y-8 sm:space-y-12 pb-32">
      {/* Header / Identity */}
      <section className="relative overflow-hidden glass glossy rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 border border-white/50 dark:border-zinc-800/50 soft-shadow">
        {/* Glossy Reflection */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="absolute top-5 right-5 sm:top-8 sm:right-8">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('profile.edit')}
            className="p-3 sm:p-4 glass glossy rounded-[1.25rem] sm:rounded-[1.5rem] text-zinc-400 hover:text-food-orange transition-all soft-shadow"
          >
            <Edit3 className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-7 sm:gap-12 relative z-10 pt-8 sm:pt-0">
          <div className="relative">
            <div className="w-28 h-28 sm:w-40 sm:h-40 bg-gradient-to-br from-food-orange/20 to-food-coral/20 rounded-[2.25rem] sm:rounded-[3rem] flex items-center justify-center text-5xl sm:text-7xl glossy shadow-inner">
              {profile.emojiAvatar}
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 w-12 h-12 sm:w-14 sm:h-14 glass glossy rounded-full flex items-center justify-center shadow-xl border border-white/50 dark:border-zinc-800/50"
            >
              <span className="text-2xl sm:text-3xl">{identity.icon}</span>
            </motion.div>
          </div>

          <div className="text-center md:text-left space-y-4">
            <h2 className="text-4xl sm:text-5xl font-display font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
              {profile.displayName}
            </h2>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <span className="px-5 py-1.5 bg-food-orange text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] glossy shadow-md">
                {identity.title}
              </span>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-md">
                {identity.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="space-y-8">
        <div className="flex items-center gap-3 px-4">
          <Trophy className="w-6 h-6 text-food-orange" />
          <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('profile.stats')}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass glossy p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-white/50 dark:border-zinc-800/50 soft-shadow space-y-4"
            >
              <div className={`w-14 h-14 ${stat.bg} rounded-[1.5rem] flex items-center justify-center glossy shadow-inner`}>
                <stat.icon className={`w-7 h-7 ${stat.color}`} />
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">
                  {stat.value} <span className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">{stat.unit}</span>
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Preferences / Identity Details */}
      <section className="grid md:grid-cols-2 gap-8">
        <div className="glass glossy p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] border border-white/50 dark:border-zinc-800/50 soft-shadow space-y-8">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-zinc-400" />
            <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('profile.preferences')}</h3>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">{t('profile.dietary')}</p>
              <div className="flex flex-wrap gap-3">
                {profile.dietaryPreferences.length > 0 ? (
                  profile.dietaryPreferences.map(pref => {
                    const key = dietaryLabelKey(pref);
                    return (
                      <span key={pref} className="px-4 py-2 glass glossy rounded-2xl text-zinc-600 dark:text-zinc-300 text-xs font-black uppercase tracking-widest">
                        {key ? t(key) : pref}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-zinc-400 italic">{t('profile.noneSet')}</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">{t('profile.style')}</p>
              <span className="px-5 py-2 bg-food-orange/10 text-food-orange text-xs font-black rounded-2xl uppercase tracking-widest glossy">
                {(() => {
                  const key = styleLabelKey(profile.cookingStyle);
                  return key ? t(key) : profile.cookingStyle;
                })()}
              </span>
            </div>
          </div>
        </div>

        <div className="glass glossy p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] border border-white/50 dark:border-zinc-800/50 soft-shadow space-y-8">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-zinc-400" />
            <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('profile.identity')}</h3>
          </div>

          <div className="flex items-start gap-6 p-6 bg-white/40 dark:bg-zinc-800/40 rounded-[2.5rem] border border-white/50 dark:border-zinc-800/50 glossy">
            <div className="text-5xl">{identity.icon}</div>
            <div>
              <p className="text-xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{identity.title}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{identity.description}</p>
            </div>
          </div>

           <div className="pt-4">
              <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">
               <span>{t('profile.nextMilestone')}</span>
               <span>{Math.min(100, (stats.totalCooked / 50) * 100).toFixed(0)}%</span>
              </div>
             <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden glossy shadow-inner">
               <motion.div
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(100, (stats.totalCooked / 50) * 100)}%` }}
                 className="h-full bg-food-orange glossy shadow-lg"
               />
             </div>
          </div>
        </div>
      </section>

      <DataBackup />
    </div>
  );
};
