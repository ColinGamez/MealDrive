import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Refrigerator,
  Sparkles,
  Loader2,
  AlertCircle,
  ShoppingCart,
  PackagePlus,
  CalendarDays,
  Clock3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n/I18nContext';
import { newId } from '../lib/id';
import { getPantryFreshness } from '../lib/pantryUtils';

import { Language, PantryItem, View } from '../types';

const STARTER_STAPLES: Record<Language, Array<Omit<PantryItem, 'id'>>> = {
  en: [
    { name: 'Eggs', amount: '6' },
    { name: 'Rice', amount: '1 kg' },
    { name: 'Garlic', amount: '1 bulb' },
    { name: 'Olive oil', amount: '500 ml' },
    { name: 'Salt', amount: '1 jar' },
    { name: 'Black pepper', amount: '1 jar' },
  ],
  ja: [
    { name: '卵', amount: '6個' },
    { name: '米', amount: '1 kg' },
    { name: 'にんにく', amount: '1玉' },
    { name: 'オリーブオイル', amount: '500 ml' },
    { name: '塩', amount: '1瓶' },
    { name: '黒こしょう', amount: '1瓶' },
  ],
  ko: [
    { name: '달걀', amount: '6개' },
    { name: '쌀', amount: '1 kg' },
    { name: '마늘', amount: '1통' },
    { name: '올리브 오일', amount: '500 ml' },
    { name: '소금', amount: '1병' },
    { name: '후추', amount: '1병' },
  ],
};

interface Props {
  pantry: PantryItem[];
  onAdd: (item: PantryItem) => void;
  onAddMany: (items: PantryItem[]) => void;
  onRemove: (id: string) => void;
  onToggleLowStock: (id: string) => void;
  onUpdateExpiry: (id: string, expiresAt?: string) => void;
  onClear: () => void;
  onGenerateRecipes: () => void;
  onAddLowStockToShopping: () => void;
  onViewChange: (view: View) => void;
  isGenerating: boolean;
}

export const Pantry: React.FC<Props> = ({
  pantry,
  onAdd,
  onAddMany,
  onRemove,
  onToggleLowStock,
  onUpdateExpiry,
  onClear,
  onGenerateRecipes,
  onAddLowStockToShopping,
  onViewChange,
  isGenerating,
}) => {
  const { t, language } = useI18n();
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const { useSoonItems, lowStockItems, inStockItems } = useMemo(() => {
    const groups = {
      useSoonItems: [] as PantryItem[],
      lowStockItems: [] as PantryItem[],
      inStockItems: [] as PantryItem[],
    };

    pantry.forEach((item) => {
      const freshness = getPantryFreshness(item);
      if (freshness.status === 'expired' || freshness.status === 'useSoon') {
        groups.useSoonItems.push(item);
      } else if (item.isLowStock) {
        groups.lowStockItems.push(item);
      } else {
        groups.inStockItems.push(item);
      }
    });

    return groups;
  }, [pantry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      onAdd({
        id: newId(),
        name: newItem.trim(),
        amount: newAmount.trim() || undefined,
        expiresAt: newExpiry || undefined,
      });
      setNewItem('');
      setNewAmount('');
      setNewExpiry('');
    }
  };

  const handleAddStaples = () => {
    onAddMany(STARTER_STAPLES[language].map((item) => ({ ...item, id: newId() })));
  };

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-9">
        <div>
          <h2 className="text-4xl sm:text-5xl font-display font-black text-zinc-950 dark:text-white mb-2 tracking-[-0.04em]">{t('pantry.title')}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-lg font-medium">{t('pantry.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {pantry.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-3 text-xs font-extrabold text-zinc-400 hover:text-red-500 transition-all uppercase tracking-wider"
            >
              {t('common.clearAll')}
            </button>
          )}
          <button
            type="button"
            onClick={onGenerateRecipes}
            disabled={pantry.length === 0 || isGenerating}
            className="min-h-12 px-6 py-3 bg-food-orange text-white rounded-2xl text-sm font-extrabold hover:-translate-y-0.5 transition-all shadow-lg shadow-food-orange/20 flex items-center gap-2.5 disabled:opacity-50 disabled:grayscale disabled:translate-y-0"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {t('common.findRecipes')}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 mb-10 bg-white p-3 rounded-[1.5rem] border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm">
        <div className="relative flex-1">
          <label htmlFor="pantry-item-name" className="sr-only">{t('pantry.ingredientPlaceholder')}</label>
          <input
            id="pantry-item-name"
            name="ingredient"
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={t('pantry.ingredientPlaceholder')}
            autoComplete="off"
            aria-label={t('pantry.ingredientPlaceholder')}
            className="w-full min-h-14 pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-transparent rounded-2xl text-base font-bold focus:border-food-orange focus:bg-white transition-all dark:text-white placeholder:text-zinc-400"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-food-orange">
            <Plus className="w-5 h-5" />
          </div>
        </div>
        <div className="md:w-56">
          <label htmlFor="pantry-item-amount" className="sr-only">{t('pantry.qtyPlaceholder')}</label>
          <input
            id="pantry-item-amount"
            name="amount"
            type="text"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder={t('pantry.qtyPlaceholder')}
            autoComplete="off"
            aria-label={t('pantry.qtyPlaceholder')}
            className="w-full min-h-14 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-transparent rounded-2xl text-base font-bold focus:border-food-orange focus:bg-white transition-all dark:text-white placeholder:text-zinc-400"
          />
        </div>
        <div className="relative md:w-48">
          <label htmlFor="pantry-item-expiry" className="sr-only">{t('pantry.expiryDate')}</label>
          <input
            id="pantry-item-expiry"
            name="expiry"
            type="date"
            value={newExpiry}
            onChange={(e) => setNewExpiry(e.target.value)}
            aria-label={t('pantry.expiryDate')}
            className="w-full min-h-14 pl-11 pr-3 py-3 bg-zinc-50 dark:bg-zinc-950 border border-transparent rounded-2xl text-sm font-bold text-zinc-700 focus:border-food-orange focus:bg-white transition-all dark:text-zinc-200"
          />
          <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
        <button
          type="submit"
          className="min-h-14 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-2xl text-sm font-extrabold hover:bg-zinc-800 dark:hover:bg-white transition-all shadow-md"
        >
          {t('pantry.addItem')}
        </button>
      </form>

      {pantry.length === 0 ? (
        <div className="relative overflow-hidden text-center px-6 py-14 sm:py-20 bg-[#fff9f6] dark:bg-zinc-900 rounded-[1.75rem] border border-orange-100 dark:border-orange-500/10">
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-100/60 blur-3xl dark:bg-orange-500/5" />
          <div className="relative w-20 h-20 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 text-food-orange border border-orange-100 dark:border-zinc-700 shadow-sm">
            <Refrigerator className="w-10 h-10" />
          </div>
          <h3 className="relative text-2xl sm:text-3xl font-display font-black text-zinc-950 dark:text-white mb-3 tracking-tight">{t('pantry.emptyTitle')}</h3>
          <p className="relative text-zinc-500 dark:text-zinc-400 text-base max-w-lg mx-auto mb-8 font-medium leading-7">{t('pantry.emptyDesc')}</p>
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleAddStaples}
              className="min-h-12 px-6 py-3 bg-food-orange text-white rounded-2xl text-sm font-extrabold hover:-translate-y-0.5 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 inline-flex items-center justify-center gap-2.5"
            >
              <PackagePlus className="w-5 h-5" />
              {t('pantry.addStaples')}
            </button>
            <button
              type="button"
              onClick={() => onViewChange('home')}
              className="min-h-12 px-6 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm font-extrabold hover:border-orange-200 hover:text-food-orange transition-all inline-flex items-center justify-center gap-2.5"
            >
              <Refrigerator className="w-5 h-5" />
              {t('common.scanFridge')}
            </button>
          </div>
          <div className="relative mt-8 mx-auto max-w-xl border-t border-orange-100 dark:border-zinc-800 pt-6">
            <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{t('pantry.starterStaples')}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t('pantry.starterStaplesDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-20">
          {useSoonItems.length > 0 && (
            <section>
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/10 rounded-[1.5rem] flex items-center justify-center">
                  <Clock3 className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('pantry.useSoonTitle')}</h3>
                  <p className="text-sm text-amber-600 font-black uppercase tracking-widest">{t('pantry.useSoonDesc')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {useSoonItems.map((item) => (
                    <PantryCard
                      key={item.id}
                      item={item}
                      onRemove={onRemove}
                      onToggleLowStock={onToggleLowStock}
                      onUpdateExpiry={onUpdateExpiry}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {lowStockItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-food-orange/20 rounded-[1.5rem] flex items-center justify-center glossy">
                    <AlertCircle className="w-7 h-7 text-food-orange" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('pantry.lowStockTitle')}</h3>
                    <p className="text-sm text-food-orange font-black uppercase tracking-widest">{t('pantry.lowStockDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAddLowStockToShopping}
                  className="flex items-center gap-3 px-6 py-3 bg-food-orange/10 text-food-orange rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-food-orange hover:text-white transition-all border border-food-orange/20 glossy"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {t('pantry.addAllToShopping')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {lowStockItems.map((item) => (
                    <PantryCard
                      key={item.id}
                      item={item}
                      onRemove={onRemove}
                      onToggleLowStock={onToggleLowStock}
                      onUpdateExpiry={onUpdateExpiry}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {inStockItems.length > 0 && (
          <section>
            <div className="flex items-center gap-5 mb-10">
              <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-[1.5rem] flex items-center justify-center glossy">
                <Refrigerator className="w-7 h-7 text-zinc-400" />
              </div>
              <div>
                <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">{t('pantry.inStockTitle')}</h3>
                <p className="text-sm text-zinc-400 font-black uppercase tracking-widest">{t('pantry.inStockDesc')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {inStockItems.map((item) => (
                  <PantryCard
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onToggleLowStock={onToggleLowStock}
                    onUpdateExpiry={onUpdateExpiry}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
          )}
        </div>
      )}
    </div>
  );
};

const PantryCard = React.memo<{
  item: PantryItem;
  onRemove: (id: string) => void;
  onToggleLowStock: (id: string) => void;
  onUpdateExpiry: (id: string, expiresAt?: string) => void;
}>(({ item, onRemove, onToggleLowStock, onUpdateExpiry }) => {
  const { t, locale } = useI18n();
  const toggleLabel = item.isLowStock ? t('pantry.markInStock') : t('pantry.markLowStock');
  const freshness = getPantryFreshness(item);
  const isExpired = freshness.status === 'expired';
  const isUseSoon = freshness.status === 'useSoon';
  const expiryLabel = (() => {
    if (isExpired) return t('pantry.expired');
    if (freshness.daysRemaining === 0) return t('pantry.useToday');
    if (freshness.daysRemaining === 1) return t('pantry.useTomorrow');
    if (isUseSoon) return t('pantry.useInDays', { count: freshness.daysRemaining ?? 0 });
    if (item.expiresAt) {
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
        new Date(`${item.expiresAt}T00:00:00`),
      );
    }
    return t('pantry.setExpiry');
  })();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`flex items-center justify-between p-6 rounded-[2.5rem] border transition-all group glass glossy soft-shadow ${
        isExpired
          ? 'bg-red-50/80 border-red-200 dark:bg-red-500/5 dark:border-red-500/20'
          : isUseSoon
            ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20'
            : item.isLowStock
          ? 'bg-food-orange/5 border-food-orange/20'
          : 'border-white/50 dark:border-zinc-800/50'
      }`}
    >
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center glossy shadow-inner ${
          isExpired ? 'bg-red-100 dark:bg-red-500/10' : isUseSoon ? 'bg-amber-100 dark:bg-amber-500/10' : item.isLowStock ? 'bg-food-orange/20' : 'bg-zinc-50 dark:bg-zinc-800'
        }`}>
          {isExpired || isUseSoon ? (
            <Clock3 className={`w-7 h-7 ${isExpired ? 'text-red-500' : 'text-amber-600'}`} />
          ) : item.isLowStock ? (
            <AlertCircle className="w-7 h-7 text-food-orange" />
          ) : (
            <Sparkles className="w-7 h-7 text-food-orange" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-display font-black text-zinc-900 dark:text-white capitalize tracking-tight">{item.name}</span>
            {item.isLowStock && (
              <span className="px-2 py-0.5 bg-food-orange text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-sm">{t('pantry.lowLabel')}</span>
            )}
            {(isExpired || isUseSoon) && (
              <span className={`px-2 py-0.5 text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-sm ${isExpired ? 'bg-red-500' : 'bg-amber-500'}`}>
                {expiryLabel}
              </span>
            )}
          </div>
          {item.amount && (
            <span className="text-sm text-zinc-400 font-black uppercase tracking-tighter">{item.amount}</span>
          )}
          <label
            className={`relative mt-1 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-bold ${isExpired ? 'text-red-500' : isUseSoon ? 'text-amber-600' : 'text-zinc-400 hover:text-food-orange'}`}
            title={t('pantry.expiryDate')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {expiryLabel}
            <input
              type="date"
              value={item.expiresAt ?? ''}
              onChange={(event) => onUpdateExpiry(item.id, event.target.value || undefined)}
              aria-label={t('pantry.expiryFor', { item: item.name })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleLowStock(item.id)}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={!!item.isLowStock}
          className={`p-3 rounded-2xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
            item.isLowStock
              ? 'text-food-orange hover:bg-food-orange/10'
              : 'text-zinc-300 hover:text-food-orange hover:bg-food-orange/10'
          }`}
        >
          <AlertCircle className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={t('common.remove')}
          className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
});
