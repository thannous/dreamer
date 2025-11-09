import { useMemo } from 'react';
import { getTranslator } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';

export const useTranslation = () => {
  const { language } = useLanguage();

  const t = useMemo(() => getTranslator(language), [language]);
  return { t, currentLang: language };
};

