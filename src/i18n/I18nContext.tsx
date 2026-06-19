import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { translations } from './translations';
import { Language } from '../types';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** BCP-47 locale tag derived from `language` (e.g. "en-US"). */
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGE_TO_LOCALE: Record<Language, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
};

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ja' || value === 'ko';
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = readStorage<unknown>(STORAGE_KEYS.language, 'en');
    return isLanguage(stored) ? stored : 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    writeStorage(STORAGE_KEYS.language, lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');

      const lookup = (root: any): unknown => {
        let value: any = root;
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            return undefined;
          }
        }
        return value;
      };

      let value = lookup((translations as any)[language]);
      if (typeof value !== 'string') {
        value = lookup((translations as any).en);
      }
      if (typeof value !== 'string') {
        return key;
      }

      if (params) {
        let formatted: string = value;
        for (const [k, v] of Object.entries(params)) {
          formatted = formatted.replace(`{${k}}`, String(v));
        }
        return formatted;
      }
      return value;
    },
    [language],
  );

  const value = useMemo<I18nContextType>(
    () => ({
      language,
      setLanguage,
      locale: LANGUAGE_TO_LOCALE[language],
      t,
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
