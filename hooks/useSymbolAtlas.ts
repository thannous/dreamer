import { useEffect, useMemo, useSyncExternalStore } from 'react';

import type { SymbolAtlas, SymbolAtlasEntry } from '@/lib/symbolAtlas';
import { loadSymbolAtlas, peekSymbolAtlas, subscribeSymbolAtlas } from '@/services/symbolAtlas';

/** The atlas, or undefined until one is known; the first screen that asks fetches it. */
export function useSymbolAtlas(): SymbolAtlas | undefined {
  const atlas = useSyncExternalStore(subscribeSymbolAtlas, peekSymbolAtlas);
  useEffect(() => {
    void loadSymbolAtlas();
  }, []);
  return atlas;
}

/** A symbol's living painting and scenes, when the atlas has them. */
export function useSymbolAtlasEntry(id: string | undefined): { atlas: SymbolAtlas; entry: SymbolAtlasEntry } | undefined {
  const atlas = useSymbolAtlas();
  const entry = id ? atlas?.symbols[id] : undefined;
  return useMemo(() => (atlas && entry ? { atlas, entry } : undefined), [atlas, entry]);
}
