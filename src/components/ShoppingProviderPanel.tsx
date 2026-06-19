import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, Copy, ExternalLink, Globe2, Loader2, Server } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { ShoppingExportResponse, ShoppingItem } from '../types';
import { buildShoppingIntegrationPlan } from '../services/shoppingProviders';
import { exportShoppingList, ShoppingExportClientError } from '../services/shoppingClient';

interface Props {
  items: ShoppingItem[];
}

const PROVIDER_DESCRIPTION_KEYS = {
  instacart: 'shopping.instacartDesc',
  rakuten: 'shopping.rakutenDesc',
  naver: 'shopping.naverDesc',
} as const;

const MARKET_KEYS = {
  northAmerica: 'shopping.marketNorthAmerica',
  japan: 'shopping.marketJapan',
  korea: 'shopping.marketKorea',
} as const;

export const ShoppingProviderPanel: React.FC<Props> = ({ items }) => {
  const { t, language } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ShoppingExportResponse | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [missingCredentials, setMissingCredentials] = useState<string[]>([]);

  const plan = useMemo(() => buildShoppingIntegrationPlan(language, items), [language, items]);
  const requestPreview = useMemo(() => JSON.stringify(plan.requestPreview, null, 2), [plan.requestPreview]);

  useEffect(() => {
    startTransition(() => {
      setExportResult(null);
      setExportError(null);
      setMissingCredentials([]);
    });
  }, [items, language]);

  const handleCopy = async () => {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(requestPreview);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Unable to copy shopping request preview', error);
    }
  };

  const handleExport = async () => {
    if (plan.activeItems.length === 0) return;

    setIsExporting(true);
    setExportError(null);
    setMissingCredentials([]);

    try {
      const result = await exportShoppingList(language, items);
      startTransition(() => {
        setExportResult(result);
      });
    } catch (error) {
      console.error('Unable to create shopping export', error);

      startTransition(() => {
        setExportResult(null);
        if (error instanceof ShoppingExportClientError) {
          setExportError(error.message);
          setMissingCredentials(error.missingCredentials || []);
          return;
        }
        setExportError(t('shopping.exportFailed'));
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="mb-10 glass glossy rounded-[3rem] border border-white/50 dark:border-zinc-800/50 soft-shadow p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-food-orange/10 text-food-orange text-[10px] font-black uppercase tracking-[0.2em]">
            <Server className="w-3.5 h-3.5" />
            {t('shopping.providerTitle')}
          </div>
          <div>
            <h3 className="text-3xl font-display font-black tracking-tighter text-zinc-900 dark:text-white">
              {plan.provider.name}
            </h3>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-base font-medium leading-relaxed">
              {t('shopping.providerDesc')}
            </p>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t(PROVIDER_DESCRIPTION_KEYS[plan.provider.id])}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
          <div className="rounded-[2rem] bg-white/60 dark:bg-zinc-900/50 border border-white/60 dark:border-zinc-800/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
              {t('shopping.activeProvider')}
            </p>
            <p className="text-xl font-display font-black tracking-tight text-zinc-900 dark:text-white">
              {plan.provider.name}
            </p>
          </div>
          <div className="rounded-[2rem] bg-white/60 dark:bg-zinc-900/50 border border-white/60 dark:border-zinc-800/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
              {t('shopping.marketLabel')}
            </p>
            <p className="text-xl font-display font-black tracking-tight text-zinc-900 dark:text-white">
              {t(MARKET_KEYS[plan.provider.market])}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-[2.5rem] bg-zinc-950 text-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
              {t('shopping.requestPreview')}
            </p>
            <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
              {plan.activeItems.length > 0
                ? t('shopping.usingItems', { count: plan.activeItems.length })
                : t('shopping.allChecked')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={plan.provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-colors text-sm font-bold"
            >
              <Globe2 className="w-4 h-4" />
              {t('shopping.apiDocs')}
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-food-orange text-white hover:bg-orange-500 transition-colors text-sm font-bold"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t('shopping.copied') : t('shopping.copyRequest')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || plan.activeItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white text-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors text-sm font-bold"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
              {isExporting ? t('common.loading') : t('shopping.fetchLiveExport')}
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <pre className="overflow-x-auto rounded-[2rem] bg-black/30 border border-white/10 p-5 text-xs leading-6 text-zinc-100 whitespace-pre-wrap break-all">
            {requestPreview}
          </pre>

          <div className="space-y-4">
            <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                {t('shopping.methodLabel')}
              </p>
              <p className="text-sm font-bold text-white break-all">{plan.requestPreview.method}</p>
            </div>

            <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                {t('shopping.endpointLabel')}
              </p>
              <p className="text-sm font-bold text-white break-all">{plan.provider.endpoint}</p>
            </div>

            <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                {t('shopping.credentialsLabel')}
              </p>
              <p className="text-sm font-bold text-white break-words">{plan.provider.credentials.join(', ')}</p>
            </div>

            <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                {t('shopping.searchTerms')}
              </p>
              <p className="text-sm text-zinc-200 leading-relaxed break-words">
                {plan.combinedQuery || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {exportError && (
        <div className="mt-6 rounded-[2rem] border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-5 text-red-700 dark:text-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-black uppercase tracking-[0.2em]">{t('shopping.setupNeeded')}</p>
              <p className="text-sm leading-relaxed">{exportError}</p>
              {missingCredentials.length > 0 && (
                <p className="text-sm leading-relaxed">
                  {t('shopping.missingCredentials', { keys: missingCredentials.join(', ') })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {exportResult?.mode === 'link' && exportResult.url && (
        <div className="mt-6 rounded-[2rem] border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">
            {t('shopping.linkReady')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('shopping.resultsForQuery', { query: exportResult.query || '—' })}
          </p>
          <a
            href={exportResult.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm font-bold"
          >
            <ExternalLink className="w-4 h-4" />
            {t('shopping.openShoppingLink')}
          </a>
        </div>
      )}

      {exportResult?.mode === 'results' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
                {t('shopping.liveResults')}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t('shopping.resultsForQuery', { query: exportResult.query || '—' })}
              </p>
            </div>
            <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
              {t('shopping.liveMatches', { count: exportResult.results?.length || 0 })}
            </p>
          </div>

          {exportResult.results && exportResult.results.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {exportResult.results.map((result) => (
                <article
                  key={result.id}
                  className="rounded-[2rem] border border-white/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/50 p-5 flex gap-4 items-start"
                >
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.title}
                      width="88"
                      height="88"
                      loading="lazy"
                      className="w-24 h-24 rounded-[1.5rem] object-cover shrink-0 bg-zinc-100 dark:bg-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-[1.5rem] shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Server className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-display font-black tracking-tight text-zinc-900 dark:text-white line-clamp-2">
                      {result.title}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      {result.merchant && <span>{result.merchant}</span>}
                      {result.price && <span>{result.price}</span>}
                    </div>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-food-orange hover:text-orange-500 transition-colors"
                    >
                      {t('shopping.openProduct')}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-white/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/50 p-5 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t('shopping.noLiveMatches')}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {plan.noteKeys.map((noteKey) => (
          <div
            key={noteKey}
            className="rounded-[2rem] bg-white/70 dark:bg-zinc-900/50 border border-white/60 dark:border-zinc-800/60 p-5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed"
          >
            {t(noteKey)}
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {t('shopping.serverNote')}
      </p>
    </section>
  );
};
