import type { ExtendedSymbolContent, SymbolLanguage } from '@/lib/symbolTypes';

// Web keeps the bundled copy: a cross-origin fetch to noctalia.app would need
// CORS headers, and download size is a native concern.
import extendedDataJson from '@/data/app/dream-symbols-extended.json';

export type ExtendedSymbolContentMap = Record<string, ExtendedSymbolContent>;

const extendedData = extendedDataJson as Record<string, Partial<Record<SymbolLanguage, ExtendedSymbolContent>>>;
const byLanguage = new Map<SymbolLanguage, ExtendedSymbolContentMap>();

export function peekExtendedSymbolContent(language: SymbolLanguage): ExtendedSymbolContentMap {
  let content = byLanguage.get(language);
  if (!content) {
    content = {};
    for (const [id, locales] of Object.entries(extendedData)) {
      const entry = locales[language];
      if (entry) content[id] = entry;
    }
    byLanguage.set(language, content);
  }
  return content;
}

export function loadExtendedSymbolContent(language: SymbolLanguage): Promise<ExtendedSymbolContentMap> {
  return Promise.resolve(peekExtendedSymbolContent(language));
}
