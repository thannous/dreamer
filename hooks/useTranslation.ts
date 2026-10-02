import { useEffect, useMemo, useState } from 'react';
import { areTranslationsLoaded, getTranslator, loadTranslations } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';

export const useTranslation = () => {
  'use no memo'; // Language-pack readiness comes from an external mutable cache.
  const { language } = useLanguage();
  const [translationRevision, setTranslationRevision] = useState(0);
  // Capture readiness during render so a pack loaded before the effect still
  // refreshes any fallback text that was just rendered.
  const translationsLoaded = areTranslationsLoaded(language);

  useEffect(() => {
    if (translationsLoaded) {
      return;
    }

    let active = true;

    loadTranslations(language).then(() => {
      if (active) {
        setTranslationRevision((current) => current + 1);
      }
    });

    return () => {
      active = false;
    };
  }, [language, translationsLoaded]);

  // Invalidate memoized copy once a lazy language pack replaces its fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- The revision represents changes in the external translation cache.
  const t = useMemo(() => getTranslator(language), [language, translationRevision]);
  return { t, currentLang: language, translationRevision };
};
