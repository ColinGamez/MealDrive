import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, X } from 'lucide-react';
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
    <div className="w-full max-w-2xl mx-auto p-6">
      <div 
        className="relative aspect-video rounded-3xl border-2 border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center overflow-hidden group hover:border-orange-400 transition-colors cursor-pointer"
        onClick={() => !isAnalyzing && fileInputRef.current?.click()}
      >
        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <img src={preview} alt="Fridge Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white font-medium flex items-center gap-2">
                  <Upload className="w-5 h-5" /> {t('scanner.changePhoto')}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-8"
            >
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-display font-semibold text-zinc-800 mb-2">{t('scanner.title')}</h3>
              <p className="text-zinc-500">{t('scanner.desc')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {isAnalyzing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-4" />
            <p className="text-zinc-800 font-medium animate-pulse font-display">{t('scanner.analyzing')}</p>
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
