import type { AppLanguage } from '@/lib/types';

export type LegalLinkKind = 'privacyPolicy' | 'termsOfUse';

/** Localised legal pages on the Noctalia site; the app's `pt` maps to `pt-br`. */
const LEGAL_LINKS: Record<LegalLinkKind, Record<AppLanguage, string>> = {
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
};

export const SUPPORT_EMAIL = 'contact@noctalia.app';

export function getLegalLink(kind: LegalLinkKind, language: AppLanguage): string {
  return LEGAL_LINKS[kind][language] ?? LEGAL_LINKS[kind].en;
}
