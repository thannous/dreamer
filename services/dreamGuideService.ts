import { IconSymbol } from '@/components/ui/icon-symbol';
import curationPagesJson from '@/docs-src/static/data/curation-pages.json';
import type {
  DreamGuide,
  DreamGuideId,
  DreamGuideLanguage,
  LocalizedDreamGuideContent,
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
const IMPORTANT_GUIDE_IDS: readonly DreamGuideId[] = [
  'most-common-dream-symbols',
  'scary-dream-symbols',
  'animal-dream-symbols',
  'water-dream-symbols',
];

const GUIDE_ICONS: Record<DreamGuideId, IconName> = {
  'most-common-dream-symbols': 'sparkles',
  'scary-dream-symbols': 'moon.stars.fill',
  'animal-dream-symbols': 'pawprint.fill',
  'water-dream-symbols': 'drop.fill',
};

const CURATION_PAGES = (curationPagesJson as { pages: CurationPage[] }).pages;
const CURATION_PAGES_BY_ID = new Map(CURATION_PAGES.map((guide) => [guide.id, guide]));

const IMPORTANT_GUIDES = IMPORTANT_GUIDE_IDS.map((id) => {
  const guide = CURATION_PAGES_BY_ID.get(id);
  if (!guide) {
    throw new Error(`Missing important dream guide in site content: ${id}`);
  }
  return guide as DreamGuide;
});

export function getImportantDreamGuides(): DreamGuide[] {
  return IMPORTANT_GUIDES;
}

export function getDreamGuideById(id: string): DreamGuide | undefined {
  if (!IMPORTANT_GUIDE_IDS.includes(id as DreamGuideId)) return undefined;
  return CURATION_PAGES_BY_ID.get(id) as DreamGuide | undefined;
}

export function getDreamGuideContent(
  guide: DreamGuide,
  language: DreamGuideLanguage,
): LocalizedDreamGuideContent {
  return guide[language] ?? guide.en;
}

export function getDreamGuideIcon(id: DreamGuideId): IconName {
  return GUIDE_ICONS[id];
}

export function getDreamGuideSymbols(guide: DreamGuide): DreamSymbol[] {
  return guide.symbols
    .map((symbolId) => getSymbolById(symbolId))
    .filter((symbol): symbol is DreamSymbol => Boolean(symbol));
}
