// The release gate and full campaign share the same complete coverage union.
// Locale-specific suites run in their actual language; English-labelled tests
// stay in the full English pass, and the OFF-only case has its own bundle.
export const dreamerCampaignContexts = [
  { locale: 'en-US', featureSheets: true, args: [] },
  { locale: 'fr-FR', featureSheets: true, args: ['--tag', 'locale-fr-FR'] },
  { locale: 'de-DE', featureSheets: true, args: ['--tag', 'locale-de-DE'] },
  { locale: 'en-US', featureSheets: false, args: ['--grep', 'feature sheets stay disabled when switched off'] },
];
