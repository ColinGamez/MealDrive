import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onScan: (ingredients: string[]) => void;
  isAnalyzing: boolean;
}

export const IngredientScanner: React.FC<Props> = ({ onScan, isAnalyzing }) => {
  const { t } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        onScan([base64]); // We pass the image to the parent to handle analysis
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload fridge photo"
        className="relative aspect-[16/10] rounded-[3rem] border-2 border-dashed border-white/50 bg-white/10 flex flex-col items-center justify-center overflow-hidden group hover:border-food-orange transition-all cursor-pointer glass glossy soft-shadow"
        onClick={() => !isAnalyzing && fileInputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isAnalyzing) fileInputRef.current?.click(); }}
      >
        {/* Glossy Reflection */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <img src={preview} alt="Fridge Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <p className="text-white font-black uppercase tracking-widest flex items-center gap-3 text-sm">
                  <Upload className="w-6 h-6" /> {t('scanner.changePhoto')}
                </p>
              </div>

              {/* Magical Scan Line */}
              {isAnalyzing && (
                <motion.div
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-food-orange to-transparent shadow-[0_0_20px_rgba(255,107,53,0.8)] z-20"
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-12"
            >
              <div className="w-24 h-24 bg-food-orange/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 glossy shadow-inner group-hover:scale-110 transition-transform">
                <Camera className="w-12 h-12 text-food-orange" />
              </div>
              <h3 className="text-4xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('scanner.title')}</h3>
              <p className="text-zinc-500 text-lg font-medium max-w-xs mx-auto">{t('scanner.desc')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {isAnalyzing && (
          <div className="absolute inset-0 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md flex flex-col items-center justify-center z-30">
            <div className="relative">
              <Loader2 className="w-20 h-20 text-food-orange animate-spin mb-6" />
              <div className="absolute inset-0 blur-xl bg-food-orange/30 animate-pulse" />
            </div>
            <p className="text-zinc-900 dark:text-white text-xl font-display font-black uppercase tracking-widest animate-pulse">{t('scanner.analyzing')}</p>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
};
