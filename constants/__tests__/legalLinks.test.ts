import { describe, expect, it } from '@jest/globals';

import { getLegalLink, type LegalLinkKind } from '@/constants/legalLinks';

const KINDS: LegalLinkKind[] = ['privacyPolicy', 'termsOfUse', 'accountDeletion'];

describe('getLegalLink', () => {
  it('maps every app language to its localized URL', () => {
    expect(getLegalLink('privacyPolicy', 'en')).toBe('https://noctalia.app/en/privacy-policy/');
    expect(getLegalLink('privacyPolicy', 'fr')).toBe('https://noctalia.app/fr/politique-confidentialite/');
    expect(getLegalLink('privacyPolicy', 'es')).toBe('https://noctalia.app/es/politica-privacidad/');
    expect(getLegalLink('privacyPolicy', 'de')).toBe('https://noctalia.app/de/datenschutz/');
    expect(getLegalLink('privacyPolicy', 'it')).toBe('https://noctalia.app/it/privacy-policy/');
    expect(getLegalLink('privacyPolicy', 'pt')).toBe('https://noctalia.app/pt-br/politica-de-privacidade/');

    expect(getLegalLink('termsOfUse', 'en')).toBe('https://noctalia.app/en/terms/');
    expect(getLegalLink('termsOfUse', 'fr')).toBe('https://noctalia.app/fr/cgu/');
    expect(getLegalLink('termsOfUse', 'es')).toBe('https://noctalia.app/es/terminos/');
    expect(getLegalLink('termsOfUse', 'de')).toBe('https://noctalia.app/de/agb/');
    expect(getLegalLink('termsOfUse', 'it')).toBe('https://noctalia.app/it/termini/');
    expect(getLegalLink('termsOfUse', 'pt')).toBe('https://noctalia.app/pt-br/termos-de-uso/');

    expect(getLegalLink('accountDeletion', 'en')).toBe('https://noctalia.app/en/account-deletion/');
    expect(getLegalLink('accountDeletion', 'fr')).toBe('https://noctalia.app/fr/suppression-compte/');
    expect(getLegalLink('accountDeletion', 'es')).toBe('https://noctalia.app/es/eliminacion-cuenta/');
    expect(getLegalLink('accountDeletion', 'de')).toBe('https://noctalia.app/de/konto-loeschen/');
    expect(getLegalLink('accountDeletion', 'it')).toBe('https://noctalia.app/it/eliminazione-account/');
    expect(getLegalLink('accountDeletion', 'pt')).toBe('https://noctalia.app/pt-br/exclusao-de-conta/');
  });

  it('accepts the pt-br locale tag used by the website', () => {
    expect(getLegalLink('privacyPolicy', 'pt-br')).toBe('https://noctalia.app/pt-br/politica-de-privacidade/');
  });

  it('falls back to English for unknown or missing languages', () => {
    for (const kind of KINDS) {
      expect(getLegalLink(kind, 'jp')).toBe(getLegalLink(kind, 'en'));
      expect(getLegalLink(kind, null)).toBe(getLegalLink(kind, 'en'));
      expect(getLegalLink(kind, undefined)).toBe(getLegalLink(kind, 'en'));
      expect(getLegalLink(kind, '')).toBe(getLegalLink(kind, 'en'));
    }
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(getLegalLink('termsOfUse', ' FR ')).toBe('https://noctalia.app/fr/cgu/');
  });
});
