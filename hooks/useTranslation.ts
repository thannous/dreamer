import { useEffect, useMemo, useState } from 'react';
import { getTranslator, loadTranslations } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';

export const useTranslation = () => {
  const { language } = useLanguage();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (language === 'en') {
      return;
    }

    let active = true;

    loadTranslations(language).then(() => {
      if (active) {
        setRevision((current) => current + 1);
      }
    });

    return () => {
      active = false;
    };
  }, [language]);

  const t = useMemo(() => getTranslator(language), [language, revision]);
  return { t, currentLang: language };
};
