import React from 'react';
import { Sparkles, ChefHat, ShoppingBag, X, Refrigerator } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onDismiss: () => void;
  onAction: (view: string) => void;
}

export const OnboardingCard: React.FC<Props> = ({ onDismiss, onAction }) => {
  const { t } = useI18n();

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-gradient-to-br from-orange-600 to-orange-700 rounded-[32px] p-8 text-white shadow-2xl shadow-orange-600/20 overflow-hidden mb-12"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />
      
      <button 
        onClick={onDismiss}
        className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shrink-0">
          <ChefHat className="w-10 h-10 text-white" />
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-display font-bold mb-2">{t('onboarding.welcome')}</h2>
          <p className="text-orange-50/80 text-lg max-w-xl">
            {t('onboarding.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 relative z-10">
        {[
          { 
            icon: Refrigerator, 
            title: t('onboarding.step1Title'), 
            desc: t('onboarding.step1Desc'),
            action: 'pantry'
          },
          { 
            icon: Sparkles, 
            title: t('onboarding.step2Title'), 
            desc: t('onboarding.step2Desc'),
            action: 'recipes'
          },
          { 
            icon: ShoppingBag, 
            title: t('onboarding.step3Title'), 
            desc: t('onboarding.step3Desc'),
            action: 'shopping'
          }
        ].map((step, i) => (
          <button 
            key={i}
            onClick={() => onAction(step.action)}
            className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-left hover:bg-white/20 transition-all group"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <step.icon className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-white mb-1">{step.title}</h4>
            <p className="text-orange-50/60 text-xs leading-relaxed">{step.desc}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
