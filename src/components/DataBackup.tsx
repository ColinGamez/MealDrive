import React, { useMemo, useRef, useState } from 'react';
import { DatabaseBackup, Download, FileCheck2, ShieldCheck, Upload, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  MealDriveBackup,
  createMealDriveBackup,
  parseMealDriveBackup,
  restoreMealDriveBackup,
  serializeMealDriveBackup,
  summarizeMealDriveBackup,
} from '../lib/backup';

interface PendingBackup {
  backup: MealDriveBackup;
  fileName: string;
}

type BackupErrorKey = 'profile.invalidBackup' | 'profile.exportFailed' | 'profile.restoreFailed';

export const DataBackup: React.FC = () => {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [errorKey, setErrorKey] = useState<BackupErrorKey | null>(null);
  const [didExport, setDidExport] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const summary = useMemo(
    () => (pending ? summarizeMealDriveBackup(pending.backup) : null),
    [pending],
  );

  const handleExport = () => {
    try {
      const backup = createMealDriveBackup(window.localStorage);
      const blob = new Blob([serializeMealDriveBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const localNow = new Date();
      const localDate = [
        String(localNow.getFullYear()),
        String(localNow.getMonth() + 1).padStart(2, '0'),
        String(localNow.getDate()).padStart(2, '0'),
      ].join('-');
      link.href = url;
      link.download = `mealdrive-backup-${localDate}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDidExport(true);
      setErrorKey(null);
    } catch {
      setDidExport(false);
      setErrorKey('profile.exportFailed');
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = parseMealDriveBackup(await file.text());
      setPending({ backup, fileName: file.name });
      setErrorKey(null);
      setDidExport(false);
    } catch {
      setPending(null);
      setErrorKey('profile.invalidBackup');
    }
  };

  const handleRestore = () => {
    if (!pending) return;
    setIsRestoring(true);
    try {
      restoreMealDriveBackup(pending.backup, window.localStorage);
      window.location.reload();
    } catch {
      setIsRestoring(false);
      setErrorKey('profile.restoreFailed');
    }
  };

  const counts = summary ? [
    [t('profile.pantryItems'), summary.pantryItems],
    [t('profile.recipesCount'), summary.recipes],
    [t('profile.savedCount'), summary.savedRecipes],
    [t('profile.shoppingCount'), summary.shoppingItems],
    [t('profile.mealPlanDays'), summary.mealPlanDays],
    [t('profile.notesCount'), summary.notes],
  ] : [];

  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/55 shadow-xl shadow-zinc-900/5 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/55 sm:rounded-[3.5rem]">
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <DatabaseBackup className="h-6 w-6" />
            </span>
            <div>
              <h3 className="font-display text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                {t('profile.backupTitle')}
              </h3>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {t('profile.backupDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-fresh-green" />
            <span>{t('profile.backupPrivacy')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={handleExport}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            <Download className="h-4 w-4" />
            {t('profile.exportData')}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-700 transition hover:-translate-y-0.5 hover:border-food-orange hover:text-food-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Upload className="h-4 w-4" />
            {t('profile.importData')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="sr-only"
            aria-label={t('profile.importData')}
          />
        </div>
      </div>

      <div aria-live="polite">
        {didExport && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 sm:px-10">
            {t('profile.exportReady')}
          </div>
        )}
        {errorKey && (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 sm:px-10">
            {t(errorKey)}
          </div>
        )}
      </div>

      {pending && summary && (
        <div className="border-t border-zinc-200/70 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-fresh-green" />
              <div className="min-w-0">
                <h4 className="font-display text-xl font-black text-zinc-900 dark:text-white">
                  {t('profile.importPreview')}
                </h4>
                <p className="truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {pending.fileName} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(pending.backup.exportedAt))}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPending(null)}
              aria-label={t('common.cancel')}
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {counts.map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-black text-zinc-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
              {t('profile.restoreWillReplace')}
            </p>
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring}
              className="min-h-11 shrink-0 rounded-xl bg-food-orange px-5 text-sm font-black text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isRestoring ? t('profile.restoring') : t('profile.restoreBackup')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
