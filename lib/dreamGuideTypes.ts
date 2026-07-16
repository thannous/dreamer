import type { SymbolLanguage } from '@/lib/symbolTypes';

export type DreamGuideLanguage = SymbolLanguage;

export type SymbolDreamGuideId =
  | 'most-common-dream-symbols'
  | 'scary-dream-symbols'
  | 'animal-dream-symbols'
  | 'water-dream-symbols';

export type PracticalDreamGuideId =
  | 'understand-dreams'
  | 'remember-dreams'
  | 'dream-journal'
  | 'lucid-dreaming';

export type DreamGuideId = SymbolDreamGuideId | PracticalDreamGuideId;

export interface LocalizedDreamGuideContent {
  title: string;
  metaDescription: string;
  intro: string;
  outro: string;
}

export interface LocalizedPracticalDreamGuideContent extends LocalizedDreamGuideContent {
  essentialPoints: string[];
}

interface LocalizedDreamGuideFields<TContent extends LocalizedDreamGuideContent> {
  en: TContent;
  fr: TContent;
  es: TContent;
  de: TContent;
  it: TContent;
}

export interface SymbolDreamGuide
  extends LocalizedDreamGuideFields<LocalizedDreamGuideContent> {
  kind: 'symbols';
  id: SymbolDreamGuideId;
  slugs: Record<DreamGuideLanguage, string>;
  symbols: string[];
}

export interface PracticalDreamGuide
  extends LocalizedDreamGuideFields<LocalizedPracticalDreamGuideContent> {
  kind: 'practical';
  id: PracticalDreamGuideId;
  readingMinutes: number;
}

export type DreamGuide = SymbolDreamGuide | PracticalDreamGuide;

export interface DreamGuideUiCopy {
  screenTitle: string;
  screenSubtitle: string;
  dictionaryTitle: string;
  dictionaryBody: string;
  dictionaryCta: string;
  guideLabel: string;
  practicalLabel: string;
  symbolGuidesLabel: string;
  essentialsHeading: string;
  symbolsHeading: string;
  conclusionHeading: string;
  readingTime: (minutes: number) => string;
  symbolCount: (count: number) => string;
  notFound: string;
}
