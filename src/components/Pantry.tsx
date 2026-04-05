import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Refrigerator, 
  Sparkles, 
  ChevronRight,
  Loader2,
  X,
  History,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';

import { PantryItem } from '../types';

interface Props {
  pantry: PantryItem[];
  onAdd: (item: PantryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onGenerateRecipes: () => void;
  onAddLowStockToShopping: () => void;
  onViewChange: (view: any) => void;
  isGenerating: boolean;
}

export const Pantry: React.FC<Props> = ({ 
  pantry, 
  onAdd, 
  onRemove, 
  onClear, 
  onGenerateRecipes,
  onAddLowStockToShopping,
  onViewChange,
  isGenerating
}) => {
  const { t } = useI18n();
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const lowStockItems = pantry.filter(item => item.isLowStock);
  const inStockItems = pantry.filter(item => !item.isLowStock);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      onAdd({
        id: Math.random().toString(36).substr(2, 9),
        name: newItem.trim(),
        amount: newAmount.trim() || undefined
      });
      setNewItem('');
      setNewAmount('');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('pantry.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400">{t('pantry.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {pantry.length > 0 && (
            <button 
              onClick={onClear}
              className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            >
              {t('pantry.clearAll')}
            </button>
          )}
          <button 
            onClick={onGenerateRecipes}
            disabled={pantry.length === 0 || isGenerating}
            className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {t('pantry.findRecipes')}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-12">
        <div className="relative flex-1">
          <input 
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={t('pantry.inputPlaceholder')}
            className="w-full pl-14 pr-4 py-5 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] text-lg font-medium focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all shadow-sm dark:text-white"
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400">
            <Plus className="w-6 h-6" />
          </div>
        </div>
        <div className="sm:w-48">
          <input 
            type="text"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder={t('pantry.qtyPlaceholder')}
            className="w-full px-6 py-5 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] text-lg font-medium focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all shadow-sm dark:text-white"
          />
        </div>
        <button 
          type="submit"
          className="px-8 py-5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-[24px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-lg"
        >
          {t('pantry.addItem')}
        </button>
      </form>

      {pantry.length === 0 ? (
        <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[40px] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-400 dark:text-zinc-600">
            <Refrigerator className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('pantry.emptyTitle')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">{t('pantry.emptyDesc')}</p>
          <button 
            onClick={() => onViewChange('home')}
            className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 inline-flex items-center gap-2"
          >
            <Refrigerator className="w-5 h-5" />
            {t('pantry.scanFridge')}
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {lowStockItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-600/10 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white">{t('pantry.lowStock')}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('pantry.lowStockDesc')}</p>
                  </div>
                </div>
                <button 
                  onClick={onAddLowStockToShopping}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-600/10 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-600/20 transition-all border border-orange-200 dark:border-orange-600/20"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {t('pantry.addAllToShopping')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {lowStockItems.map((item) => (
                    <PantryCard key={item.id} item={item} onRemove={onRemove} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          <section>
            {lowStockItems.length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                  <Refrigerator className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white">{t('pantry.inStock')}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('pantry.inStockDesc')}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {inStockItems.map((item) => (
                  <PantryCard key={item.id} item={item} onRemove={onRemove} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const PantryCard: React.FC<{ item: PantryItem, onRemove: (id: string) => void }> = ({ item, onRemove }) => {
  const { t } = useI18n();
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
        item.isLowStock 
          ? 'bg-orange-50/30 dark:bg-orange-600/5 border-orange-100 dark:border-orange-900/20 shadow-sm' 
          : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm hover:border-orange-200 dark:hover:border-orange-900/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          item.isLowStock ? 'bg-orange-100 dark:bg-orange-600/20' : 'bg-orange-50 dark:bg-orange-600/10'
        }`}>
          {item.isLowStock ? (
            <AlertCircle className="w-5 h-5 text-orange-600" />
          ) : (
            <Sparkles className="w-5 h-5 text-orange-600" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">{item.name}</span>
            {item.isLowStock && (
              <span className="px-1.5 py-0.5 bg-orange-600 text-white text-[8px] font-black uppercase tracking-widest rounded-md">{t('pantry.lowBadge')}</span>
            )}
          </div>
          {item.amount && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{item.amount}</span>
          )}
        </div>
      </div>
      <button 
        onClick={() => onRemove(item.id)}
        className="p-2 text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </motion.div>
  );
};
