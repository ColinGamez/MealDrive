import React from 'react';
import { motion } from 'motion/react';
import { ChefHat, Sparkles, Zap, Github } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Static "About mealDrive" page. Pulled out of App.tsx so the App shell
 * doesn't carry the ~60 lines of presentation code for a screen that has
 * no shared state with the rest of the app.
 */
export const AboutView: React.FC = () => {
  const { t } = useI18n();

  return (
    <motion.div
      key="about"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto pt-12"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-12">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 mb-8">
            <ChefHat className="text-white w-8 h-8" />
          </div>
          <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">
            {t('about.title')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed mb-8">
            {t('about.subtitle')} {t('about.philosophy1')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="space-y-4">
              <h4 className="font-display font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600" />
                {t('onboarding.step1Title')}
              </h4>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                {t('onboarding.step1Desc')}
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-display font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600" />
                {t('common.voiceControl')}
              </h4>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                {t('about.pantryFirstDesc')}
              </p>
            </div>
          </div>

          <div className="p-8 bg-zinc-50 dark:bg-zinc-950 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
            <h4 className="font-display font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Github className="w-5 h-5" />
              {t('about.openSourceTitle')}
            </h4>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6">
              {t('about.openSourceDesc')}
            </p>
            <a
              href="https://github.com/ColinGamez/MealDrive"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-orange-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-orange-500 transition-all shadow-lg shadow-zinc-900/20"
            >
              <Github className="w-4 h-4" />
              {t('about.viewOnGithub')}
            </a>
          </div>
        </div>

        <div className="bg-orange-600 p-8 text-white text-center">
          <p className="text-sm font-medium opacity-90">{t('about.madeWithLove')}</p>
        </div>
      </div>
    </motion.div>
  );
};
