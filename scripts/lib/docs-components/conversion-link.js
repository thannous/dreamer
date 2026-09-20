// Stable placement IDs for the four-page conversion experiment. GA4 enhanced
// measurement exposes these as link_id; this adds no client-side event handler.
const CONVERSION_PAGES = {
  '/de/guides/traumsymbole-lexikon': 'de-dictionary',
  '/es/blog/suenos-de-agua': 'es-water-dreams-meaning',
  '/it/simboli/cane': 'it-dog',
  '/it/simboli/fuoco': 'it-fire',
};

function conversionLinkAttributes(pagePath, placement, destination) {
  const page = CONVERSION_PAGES[pagePath];
  return page ? ` id="cta-${page}-${placement}-${destination}"` : '';
}

function contextConversionLinkAttributes(context, placement, destination) {
  return conversionLinkAttributes(context.entry?.locales?.[context.lang]?.path, placement, destination);
}

module.exports = { conversionLinkAttributes, contextConversionLinkAttributes };
