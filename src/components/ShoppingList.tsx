import React, { useState } from 'react';
import { Trash2, ShoppingBag, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';
import { ShoppingProviderPanel } from './ShoppingProviderPanel';

import { ShoppingItem } from '../types';

interface Props {
  items: ShoppingItem[];
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onClear: () => void;
  onAdd: (name: string, amount: string) => void;
}

export const ShoppingList: React.FC<Props> = ({ items, onRemove, onToggle, onClear, onAdd }) => {
  const { t } = useI18n();
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name, newAmount.trim());
    setNewName('');
    setNewAmount('');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-5xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('shopping.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">{t('shopping.itemsToBuy', { count: items.length })}</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="px-6 py-3 text-sm font-black text-zinc-400 hover:text-red-500 transition-all uppercase tracking-widest"
          >
            {t('shopping.clearAll')}
          </button>
        )}
      </div>

      <form
        onSubmit={handleAddSubmit}
        className="flex flex-col sm:flex-row gap-3 mb-10 glass glossy p-4 rounded-[2.5rem] border border-white/50 dark:border-zinc-800/50 soft-shadow"
      >
        <div className="relative flex-1">
          <label htmlFor="shopping-item-name" className="sr-only">{t('shopping.addItemName')}</label>
          <input
            id="shopping-item-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('shopping.addItemPlaceholder')}
            autoComplete="off"
            className="w-full bg-transparent outline-none text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 px-4 py-2"
          />
        </div>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block self-stretch my-1" />
        <div className="relative w-full sm:w-32">
          <label htmlFor="shopping-item-amount" className="sr-only">{t('shopping.addItemAmount')}</label>
          <input
            id="shopping-item-amount"
            type="text"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder={t('shopping.addItemAmountPlaceholder')}
            autoComplete="off"
            className="w-full bg-transparent outline-none text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 px-4 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={!newName.trim()}
          aria-label={t('shopping.addItem')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-food-orange text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-food-orange/20 disabled:opacity-40 disabled:hover:scale-100 glossy shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('shopping.add')}</span>
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-32 glass glossy rounded-[4rem] border border-white/50 dark:border-zinc-800/50 soft-shadow">
          <div className="w-24 h-24 bg-orange-50 dark:bg-orange-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-food-orange glossy shadow-inner">
            <ShoppingBag className="w-12 h-12" />
          </div>
          <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('shopping.emptyTitle')}</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-[240px] mx-auto font-medium">{t('shopping.emptyDesc')}</p>
        </div>
      ) : (
        <div>
          <ShoppingProviderPanel items={items} />
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ x: 4 }}
                  className={`flex items-center justify-between p-6 rounded-[2.5rem] border transition-all group glass glossy soft-shadow ${
                    item.checked
                      ? 'bg-zinc-50/50 dark:bg-zinc-900/30 border-transparent opacity-60'
                      : 'border-white/50 dark:border-zinc-800/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-pressed={item.checked}
                    aria-label={t('shopping.toggleItem', { name: item.name })}
                    className="flex items-center gap-6 flex-1 cursor-pointer text-left"
                  >
                    <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all glossy shadow-inner ${
                      item.checked
                        ? 'bg-food-orange border-food-orange'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50'
                    }`}>
                      {item.checked && <Plus className="w-6 h-6 text-white rotate-45" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-2xl font-display font-black tracking-tight transition-all ${
                        item.checked ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-900 dark:text-white'
                      }`}>
                        {item.name}
                      </span>
                      {item.amount && (
                        <span className={`text-sm font-black uppercase tracking-widest ${
                          item.checked ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-400'
                        }`}>
                          {item.amount}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={t('shopping.removeItem', { name: item.name })}
                    className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
