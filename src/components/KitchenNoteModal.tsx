import React, { useState, useEffect } from 'react';
import { X, StickyNote, Plus, Mic, MicOff, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  stepIndex?: number;
  initialContent?: string;
  isEditing?: boolean;
}

export const KitchenNoteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  stepIndex,
  initialContent = '',
  isEditing = false
}) => {
  const { t, language } = useI18n();
  const [content, setContent] = useState(initialContent);
  const [isDictating, setIsDictating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);
  const { isListening, transcript, start, stop } = useSpeechToText(language === 'en' ? 'en-US' : language === 'ja' ? 'ja-JP' : 'ko-KR');

  useEffect(() => {
    if (isListening) {
      setIsDictating(true);
    } else if (isDictating && transcript) {
      setContent(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsDictating(false);
    }
  }, [isListening, transcript, isDictating]);

  const quickChips = [
    t('recipes.noteTooSalty'),
    t('recipes.noteTooSpicy'),
    t('recipes.noteCookLonger'),
    t('recipes.noteLessOil'),
    t('recipes.noteUseBiggerPan'),
    t('recipes.noteGreatFlavor')
  ];

  const handleSave = () => {
    if (content.trim()) {
      onSave(content);
      setContent('');
      onClose();
    }
  };

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const addChip = (chip: string) => {
    setContent(prev => prev ? `${prev}, ${chip}` : chip);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
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
                  <StickyNote className="w-6 h-6 text-food-orange" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">
                    {isEditing ? t('recipes.editNote') : t('recipes.addKitchenNote')}
                  </h2>
                  {stepIndex !== undefined && (
                    <p className="text-[10px] font-black text-food-orange uppercase tracking-widest">
                      {t('recipes.forStep', { step: stepIndex + 1 })}
                    </p>
                  )}
                </div>
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
              <div className="space-y-2">
                <label htmlFor="kitchen-note-textarea" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                  {t('recipes.yourAdjustment')}
                </label>
                <div className="relative">
                  <textarea
                    id="kitchen-note-textarea"
                    autoFocus
                    value={isListening ? (content ? `${content} ${transcript}` : transcript) : content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={isListening ? t('common.listening') : t('recipes.notePlaceholder')}
                    className="w-full px-6 py-4 bg-white/50 dark:bg-zinc-900/50 border border-white/50 dark:border-zinc-800/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-food-orange/50 transition-all font-medium min-h-[120px] resize-none pr-16"
                  />
                  <button
                    type="button"
                    onClick={isListening ? stop : start}
                    aria-label={isListening ? t('common.stop') : t('common.voiceControl')}
                    className={`absolute right-4 top-4 p-3 rounded-xl transition-all ${isListening ? 'bg-food-orange text-white animate-pulse shadow-lg shadow-food-orange/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-food-orange'}`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                  {t('recipes.quickSelect')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickChips.map((chip, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => addChip(chip)}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-food-orange hover:text-white rounded-xl text-xs font-black transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!content.trim()}
                className="w-full py-5 bg-food-orange text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-food-orange/20 glossy flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:scale-100 hover:scale-105 transition-all"
              >
                {isEditing ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {isEditing ? t('common.save') : t('recipes.saveNote')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
