import React from 'react';
import { Trash2, ShoppingBag, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

import { ShoppingItem } from '../types';

interface Props {
  items: ShoppingItem[];
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export const ShoppingList: React.FC<Props> = ({ items, onRemove, onToggle, onClear }) => {
  const { t } = useI18n();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('shopping.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">{t('shopping.itemsToBuy', { count: items.length })}</p>
        </div>
        {items.length > 0 && (
          <button 
            onClick={onClear}
            className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            {t('shopping.clearAll')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-[32px] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-600">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white mb-1">{t('shopping.emptyTitle')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[200px] mx-auto">{t('shopping.emptyDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                  item.checked 
                    ? 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/50 opacity-60' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => onToggle(item.id)}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    item.checked 
                      ? 'bg-orange-600 border-orange-600' 
                      : 'border-zinc-200 dark:border-zinc-700 bg-transparent'
                  }`}>
                    {item.checked && <Plus className="w-4 h-4 text-white rotate-45" />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-bold transition-all ${
                      item.checked ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-800 dark:text-zinc-200'
                    }`}>
                      {item.name}
                    </span>
                    {item.amount && (
                      <span className={`text-xs font-medium ${
                        item.checked ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {item.amount}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(item.id)}
                  className="p-2 text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
