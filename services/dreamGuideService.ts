import { IconSymbol } from '@/components/ui/icon-symbol';
import { PRACTICAL_DREAM_GUIDES } from '@/data/practicalDreamGuides';
import curationPagesJson from '@/docs-src/static/data/curation-pages.json';
import type {
  DreamGuide,
  DreamGuideId,
  DreamGuideLanguage,
  LocalizedDreamGuideContent,
  LocalizedPracticalDreamGuideContent,
  PracticalDreamGuide,
  SymbolDreamGuide,
  SymbolDreamGuideId,
} from '@/lib/dreamGuideTypes';
import type { DreamSymbol } from '@/lib/symbolTypes';
import { getSymbolById } from '@/services/symbolDictionaryService';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type CurationPage = {
  id: string;
  slugs: Record<DreamGuideLanguage, string>;
  symbols: string[];
  en: LocalizedDreamGuideContent;
  fr: LocalizedDreamGuideContent;
  es: LocalizedDreamGuideContent;
  de: LocalizedDreamGuideContent;
  it: LocalizedDreamGuideContent;
};

// Keep this order aligned with docs-src/config/site.config.json#featuredGuideEntries.
const IMPORTANT_GUIDE_IDS: readonly SymbolDreamGuideId[] = [
  'most-common-dream-symbols',
  'scary-dream-symbols',
  'animal-dream-symbols',
  'water-dream-symbols',
];

const GUIDE_ICONS: Record<DreamGuideId, IconName> = {
  'understand-dreams': 'brain',
  'remember-dreams': 'lightbulb.fill',
  'dream-journal': 'pencil',
  'lucid-dreaming': 'eye.fill',
  'most-common-dream-symbols': 'sparkles',
  'scary-dream-symbols': 'moon.stars.fill',
  'animal-dream-symbols': 'pawprint.fill',
  'water-dream-symbols': 'drop.fill',
};

const CURATION_PAGES = (curationPagesJson as { pages: CurationPage[] }).pages;
const CURATION_PAGES_BY_ID = new Map(CURATION_PAGES.map((guide) => [guide.id, guide]));

const IMPORTANT_GUIDES: SymbolDreamGuide[] = IMPORTANT_GUIDE_IDS.map((id) => {
  const guide = CURATION_PAGES_BY_ID.get(id);
  if (!guide) {
    throw new Error(`Missing important dream guide in site content: ${id}`);
  }
  return { ...guide, kind: 'symbols' } as SymbolDreamGuide;
});

const PRACTICAL_GUIDES_BY_ID = new Map(PRACTICAL_DREAM_GUIDES.map((guide) => [guide.id, guide]));
const IMPORTANT_GUIDES_BY_ID = new Map(IMPORTANT_GUIDES.map((guide) => [guide.id, guide]));

export function getImportantDreamGuides(): SymbolDreamGuide[] {
  return IMPORTANT_GUIDES;
}

export function getGeneralDreamGuides(): PracticalDreamGuide[] {
  return [...PRACTICAL_DREAM_GUIDES];
}

export function getDreamGuideById(id: string): DreamGuide | undefined {
  return (
    PRACTICAL_GUIDES_BY_ID.get(id as PracticalDreamGuide['id']) ??
    IMPORTANT_GUIDES_BY_ID.get(id as SymbolDreamGuideId)
  );
}

export function getDreamGuideContent(
  guide: DreamGuide,
  language: DreamGuideLanguage,
): LocalizedDreamGuideContent {
  return guide[language] ?? guide.en;
}

export function getPracticalDreamGuideContent(
  guide: PracticalDreamGuide,
  language: DreamGuideLanguage,
): LocalizedPracticalDreamGuideContent {
  return guide[language] ?? guide.en;
}

export function getDreamGuideIcon(id: DreamGuideId): IconName {
  return GUIDE_ICONS[id];
}

export function getDreamGuideSymbols(guide: SymbolDreamGuide): DreamSymbol[] {
  return guide.symbols
    .map((symbolId) => getSymbolById(symbolId))
    .filter((symbol): symbol is DreamSymbol => Boolean(symbol));
}
