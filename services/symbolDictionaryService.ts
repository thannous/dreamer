import type {
  DreamSymbol,
  ExtendedSymbolContent,
  SymbolCategory,
  SymbolCategoryInfo,
  SymbolLanguage,
} from '@/lib/symbolTypes';

import symbolsDataJson from '@/docs/data/dream-symbols.json';
import extendedDataJson from '@/docs/data/dream-symbols-extended.json';
import tier3DataJson from '@/docs/data/dream-symbols-extended-tier3.json';

type IconSymbolName = Parameters<typeof import('@/components/ui/icon-symbol').IconSymbol>[0]['name'];

const symbolsData = symbolsDataJson as {
  categories: Record<SymbolCategory, SymbolCategoryInfo>;
  symbols: DreamSymbol[];
};

const extendedData = extendedDataJson as {
  symbols: Record<string, Record<string, ExtendedSymbolContent>>;
};

const tier3Data = tier3DataJson as Record<string, Record<string, ExtendedSymbolContent>>;

export function getAllSymbols(): DreamSymbol[] {
  return symbolsData.symbols;
}

export function getCategories(): Record<SymbolCategory, SymbolCategoryInfo> {
  return symbolsData.categories;
}

export function getCategoryList(): SymbolCategory[] {
  return Object.keys(symbolsData.categories) as SymbolCategory[];
}

export function getSymbolById(id: string): DreamSymbol | undefined {
  return symbolsData.symbols.find((s) => s.id === id);
}

export function getExtendedContent(
  id: string,
  language: SymbolLanguage,
): ExtendedSymbolContent | undefined {
  const extended = extendedData.symbols?.[id]?.[language];
  if (extended) return extended;
  return tier3Data[id]?.[language];
}

export function getSymbolsByCategory(category: SymbolCategory): DreamSymbol[] {
  return symbolsData.symbols
    .filter((s) => s.category === category)
    .sort((a, b) => a.priority - b.priority);
}

export function searchSymbols(query: string, language: SymbolLanguage): DreamSymbol[] {
  const lower = query.toLowerCase();
  return symbolsData.symbols.filter((s) => {
    const content = s[language] ?? s.en;
    return (
      content.name.toLowerCase().includes(lower) ||
      content.shortDescription.toLowerCase().includes(lower)
    );
  });
}

const CATEGORY_ICONS: Record<SymbolCategory, IconSymbolName> = {
  nature: 'leaf.fill',
  animals: 'pawprint.fill',
  body: 'figure.walk',
  places: 'building.2.fill',
  objects: 'cube.fill',
  actions: 'bolt.fill',
  people: 'person.2.fill',
  celestial: 'moon.stars.fill',
};

export function getCategoryIcon(category: SymbolCategory): IconSymbolName {
  return CATEGORY_ICONS[category];
}

export function getCategoryName(category: SymbolCategory, language: SymbolLanguage): string {
  const info = symbolsData.categories[category];
  return info?.[language] ?? info?.en ?? category;
}

export function parseHtmlParagraphs(html: string): string[] {
  return html
    .split('</p>')
    .map((p) => p.replace(/<p>/g, '').trim())
    .filter(Boolean);
}
