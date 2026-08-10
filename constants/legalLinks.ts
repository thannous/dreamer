export type LegalLinkKind = 'privacyPolicy' | 'termsOfUse' | 'accountDeletion';

const LEGAL_LINKS: Record<LegalLinkKind, Record<string, string>> = {
  privacyPolicy: {
    en: 'https://noctalia.app/en/privacy-policy/',
    fr: 'https://noctalia.app/fr/politique-confidentialite/',
    es: 'https://noctalia.app/es/politica-privacidad/',
    de: 'https://noctalia.app/de/datenschutz/',
    it: 'https://noctalia.app/it/privacy-policy/',
    pt: 'https://noctalia.app/pt-br/politica-de-privacidade/',
  },
  termsOfUse: {
    en: 'https://noctalia.app/en/terms/',
    fr: 'https://noctalia.app/fr/cgu/',
    es: 'https://noctalia.app/es/terminos/',
    de: 'https://noctalia.app/de/agb/',
    it: 'https://noctalia.app/it/termini/',
    pt: 'https://noctalia.app/pt-br/termos-de-uso/',
  },
  accountDeletion: {
    en: 'https://noctalia.app/en/account-deletion/',
    fr: 'https://noctalia.app/fr/suppression-compte/',
    es: 'https://noctalia.app/es/eliminacion-cuenta/',
    de: 'https://noctalia.app/de/konto-loeschen/',
    it: 'https://noctalia.app/it/eliminazione-account/',
    pt: 'https://noctalia.app/pt-br/exclusao-de-conta/',
  },
};

const FALLBACK_LANGUAGE = 'en';

/**
 * Resolves the localized marketing-site URL for a legal page.
 * The app language code is `pt` while the site locale prefix is `pt-br`;
 * unknown languages fall back to English.
 */
export function getLegalLink(kind: LegalLinkKind, language?: string | null): string {
  const urls = LEGAL_LINKS[kind];
  const normalized = language?.trim().toLowerCase() ?? '';
  const key = normalized === 'pt-br' ? 'pt' : normalized;
  return urls[key] ?? urls[FALLBACK_LANGUAGE];
}
