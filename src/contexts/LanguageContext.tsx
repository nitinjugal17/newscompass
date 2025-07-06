
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Locale } from '@/lib/translations';
import { translations, defaultLocale } from '@/lib/translations';

interface LanguageContextType {
  selectedLanguage: Locale;
  selectLanguage: (language: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(defaultLocale);

  const selectLanguage = useCallback((language: Locale) => {
    setSelectedLanguage(language);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return (
        translations[selectedLanguage]?.[key] ||
        translations[defaultLocale]?.[key] ||
        key
      );
    },
    [selectedLanguage]
  );

  return (
    <LanguageContext.Provider value={{ selectedLanguage, selectLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
