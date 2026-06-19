import React, { useState, useEffect } from 'react';
import { X, Plus, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: (durationSeconds: number, label: string) => void;
}

const TIMER_PRESETS = [1, 5, 10, 15, 30];

export const GlobalTimerModal: React.FC<Props> = ({ isOpen, onClose, onStart }) => {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState('5');
  const [seconds, setSeconds] = useState('0');

  // Reset fields each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setMinutes('5');
      setSeconds('0');
    }
  }, [isOpen]);

  const totalSeconds = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

  const handleStart = () => {
    if (totalSeconds > 0) {
      onStart(totalSeconds, label.trim() || t('recipes.customTimer'));
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md glass rounded-[3rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800/50 glossy p-8 md:p-10"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-food-orange/20 rounded-2xl flex items-center justify-center glossy">
                  <Timer className="w-6 h-6 text-food-orange" />
                </div>
                <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">
                  {t('recipes.addGlobalTimer')}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.dismiss')}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Label Input */}
              <div className="space-y-2">
                <label htmlFor="timer-label" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                  {t('recipes.timerLabel')}
                </label>
                <input
                  id="timer-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t('recipes.timerLabelPlaceholder')}
                  autoFocus
                  className="w-full px-6 py-4 bg-white/50 dark:bg-zinc-900/50 border border-white/50 dark:border-zinc-800/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-food-orange/50 transition-all font-medium"
                />
              </div>

              {/* Duration Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                  {t('recipes.duration')}
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 border border-white/50 dark:border-zinc-800/50 rounded-2xl px-4 py-2">
                    <input
                      type="number"
                      value={minutes}
                      min="0"
                      max="99"
                      onChange={(e) => setMinutes(e.target.value)}
                      aria-label={t('recipes.minutes')}
                      className="w-full bg-transparent text-center text-2xl font-display font-black focus:outline-none"
                    />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest shrink-0">{t('recipes.minutesShort')}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 border border-white/50 dark:border-zinc-800/50 rounded-2xl px-4 py-2">
                    <input
                      type="number"
                      value={seconds}
                      min="0"
                      max="59"
                      onChange={(e) => setSeconds(e.target.value)}
                      aria-label={t('recipes.seconds')}
                      className="w-full bg-transparent text-center text-2xl font-display font-black focus:outline-none"
                    />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest shrink-0">{t('recipes.secondsShort')}</span>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setMinutes(p.toString()); setSeconds('0'); }}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-food-orange hover:text-white rounded-xl text-xs font-black transition-all"
                  >
                    {p}m
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleStart}
                disabled={totalSeconds === 0}
                className="w-full py-5 bg-food-orange text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-food-orange/20 glossy flex items-center justify-center gap-3 mt-4 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 transition-all"
              >
                <Plus className="w-5 h-5" />
                {t('recipes.startTimerAction')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
