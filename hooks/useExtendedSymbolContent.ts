import { useEffect, useRef, useState } from 'react';

import { useNetworkOnline } from '@/hooks/useNetworkOnline';
import type { ExtendedSymbolContent, SymbolLanguage } from '@/lib/symbolTypes';
import {
  loadExtendedSymbolContent,
  peekExtendedSymbolContent,
  type ExtendedSymbolContentMap,
} from '@/services/symbolExtendedContent';

export type ExtendedSymbolContentState =
  | { status: 'loading'; content: undefined }
  | { status: 'ready'; content: ExtendedSymbolContent | undefined }
  | { status: 'unavailable'; content: undefined };

/**
 * A symbol's full interpretation and variations. They are downloaded once per
 * language; when that first download fails the state is `unavailable` until the
 * connection comes back, which retries.
 */
export function useExtendedSymbolContent(id: string | undefined, language: SymbolLanguage): ExtendedSymbolContentState {
  const isOnline = useNetworkOnline();
  const [loaded, setLoaded] = useState<{ language: SymbolLanguage; map: ExtendedSymbolContentMap }>();
  const [failedLanguage, setFailedLanguage] = useState<SymbolLanguage>();
  const wasOnline = useRef(isOnline);

  const map = (loaded?.language === language ? loaded.map : undefined) ?? peekExtendedSymbolContent(language);
  const failed = failedLanguage === language;

  useEffect(() => {
    if (map || failed) return;
    let cancelled = false;
    loadExtendedSymbolContent(language).then(
      (content) => {
        if (!cancelled) setLoaded({ language, map: content });
      },
      () => {
        if (!cancelled) setFailedLanguage(language);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [failed, language, map]);

  useEffect(() => {
    if (isOnline && !wasOnline.current) setFailedLanguage(undefined);
    wasOnline.current = isOnline;
  }, [isOnline]);

  if (map) return { status: 'ready', content: id ? map[id] : undefined };
  if (failed) return { status: 'unavailable', content: undefined };
  return { status: 'loading', content: undefined };
}
