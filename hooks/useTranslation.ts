import { useMemo } from 'react';
import { Platform } from 'react-native';
import { getTranslator } from '@/lib/i18n';

export const useTranslation = () => {
  let language = 'en';
  try {
    const loc = Platform.OS === 'web'
      ? (navigator as any)?.language
      : Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc && typeof loc === 'string') language = loc.split('-')[0];
  } catch {
    language = 'en';
  }

  const t = useMemo(() => getTranslator(language), [language]);
  return { t, currentLang: language };
};

