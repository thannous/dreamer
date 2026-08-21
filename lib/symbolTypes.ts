export type SymbolCategory =
  | 'nature'
  | 'animals'
  | 'body'
  | 'places'
  | 'objects'
  | 'actions'
  | 'people'
  | 'celestial';

export type SymbolPriority = 1 | 2 | 3;

export interface LocalizedSymbolContent {
  slug: string;
  name: string;
  shortDescription: string;
  askYourself: string[];
}

export interface DreamSymbol {
  id: string;
  category: SymbolCategory;
  priority: SymbolPriority;
  en: LocalizedSymbolContent;
  fr: LocalizedSymbolContent;
  es: LocalizedSymbolContent;
  de: LocalizedSymbolContent;
  it: LocalizedSymbolContent;
  pt: LocalizedSymbolContent;
  relatedSymbols: string[];
  relatedArticles: Record<string, string>;
}

export interface SymbolVariation {
  context: string;
  meaning: string;
}

export interface ExtendedSymbolContent {
  fullInterpretation: string;
  variations: SymbolVariation[];
}

export interface ExtendedSymbolData {
  en?: ExtendedSymbolContent;
  fr?: ExtendedSymbolContent;
  es?: ExtendedSymbolContent;
  de?: ExtendedSymbolContent;
  it?: ExtendedSymbolContent;
  pt?: ExtendedSymbolContent;
}

export interface SymbolCategoryInfo {
  en: string;
  fr: string;
  es: string;
  de: string;
  it: string;
  pt: string;
}

export interface SymbolsDataFile {
  meta: { version: string; lastUpdated: string; totalSymbols: number; languages: string[] };
  categories: Record<SymbolCategory, SymbolCategoryInfo>;
  symbols: DreamSymbol[];
}

export interface ExtendedSymbolsDataFile {
  meta: { description: string; lastUpdated: string };
  symbols: Record<string, ExtendedSymbolData>;
}

/**
 * Languages the in-app dictionary ships content for. Wider than the site's
 * `symbols` collection (en/fr/es/de/it): pt-BR is bundled in the app but not
 * published as symbol pages on noctalia.app.
 */
export type SymbolLanguage = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt';
