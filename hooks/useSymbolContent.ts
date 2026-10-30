import { useEffect, useState } from 'react';

import type { SymbolLanguage } from '@/lib/symbolTypes';
import { loadSymbolContent, peekSymbolContent, type SymbolContentMap } from '@/services/symbolContent';

/**
 * Every symbol's short description and questions in one language, or
 * `undefined` while the bundled asset is first read (once per launch). If
 * that language cannot be read, English stands in, as it does for a symbol
 * missing from a language.
 */
export function useSymbolContent(language: SymbolLanguage): SymbolContentMap | undefined {
  const [loaded, setLoaded] = useState<{ language: SymbolLanguage; map: SymbolContentMap }>();
  const map = (loaded?.language === language ? loaded.map : undefined) ?? peekSymbolContent(language);

  useEffect(() => {
    if (map) return;
    let cancelled = false;
    loadSymbolContent(language)
      .catch((error: unknown) => (language === 'en' ? Promise.reject(error) : loadSymbolContent('en')))
      .then(
        (content) => {
          if (!cancelled) setLoaded({ language, map: content });
        },
        () => undefined,
      );
    return () => {
      cancelled = true;
    };
  }, [language, map]);

  return map;
}
