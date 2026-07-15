import type { SymbolLanguage } from '@/lib/symbolTypes';

export type DreamGuideLanguage = SymbolLanguage;

export type DreamGuideId =
  | 'most-common-dream-symbols'
  | 'scary-dream-symbols'
  | 'animal-dream-symbols'
  | 'water-dream-symbols';

export interface LocalizedDreamGuideContent {
  title: string;
  metaDescription: string;
  intro: string;
  outro: string;
}

export interface DreamGuide {
  id: DreamGuideId;
  slugs: Record<DreamGuideLanguage, string>;
  symbols: string[];
  en: LocalizedDreamGuideContent;
  fr: LocalizedDreamGuideContent;
  es: LocalizedDreamGuideContent;
  de: LocalizedDreamGuideContent;
  it: LocalizedDreamGuideContent;
}

export interface DreamGuideUiCopy {
  screenTitle: string;
  screenSubtitle: string;
  dictionaryTitle: string;
  dictionaryBody: string;
  dictionaryCta: string;
  guideLabel: string;
  featuredLabel: string;
  symbolsHeading: string;
  conclusionHeading: string;
  symbolCount: (count: number) => string;
  notFound: string;
}
