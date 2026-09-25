import { de } from '@/lib/i18n/de';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { fr } from '@/lib/i18n/fr';
import { it as itCatalogue } from '@/lib/i18n/it';
import { pt } from '@/lib/i18n/pt';
import { translate } from '@/lib/i18n';
import { SHIPPED_LANGUAGES, type AppLanguage } from '@/lib/types';

const CATALOGUES: Record<AppLanguage, Record<string, string>> = {
  en,
  fr,
  es,
  de,
  it: itCatalogue,
  pt,
};

const REASONS = [
  'premium-session',
  'monthly-quota',
  'premium-pattern',
  'premium-timer',
] as const;

const COMMERCIAL_KEYS = [
  'paywall.cta',
  'paywall.cta.monthly',
  'paywall.plan.trial',
  'paywall.plan.price.monthly',
  'paywall.plan.renewal',
  'paywall.terms.trial',
  'paywall.terms.monthly',
  'paywall.close',
  'paywall.restore',
  'paywall.legal',
] as const;

describe('paywall copy completeness', () => {
  it.each(SHIPPED_LANGUAGES)('%s covers every paywall reason without a raw key', (language) => {
    const catalogue = CATALOGUES[language];
    const keys = [
      ...REASONS.map((reason) => `paywall.reason.${reason}`),
      'paywall.reason.fallback',
    ];

    for (const key of keys) {
      const value = catalogue[key];
      expect(value).toEqual(expect.any(String));
      expect(value).not.toContain(key);
      expect(value.toLowerCase()).not.toContain('paywall.reason');
      expect(translate(language, key as keyof typeof en)).toBe(value);
    }
  });

  it.each(SHIPPED_LANGUAGES)('%s keeps Plus and quota reasons distinct', (language) => {
    const plus = translate(language, 'paywall.reason.premium-session');
    const quota = translate(language, 'paywall.reason.monthly-quota');
    const fallback = translate(language, 'paywall.reason.fallback');

    expect(plus).not.toBe(quota);
    expect(plus.toLowerCase()).not.toContain('three');
    expect(plus.toLowerCase()).not.toContain('trois');
    expect(plus.toLowerCase()).not.toContain('drei');
    expect(plus.toLowerCase()).not.toContain('tre');
    expect(plus.toLowerCase()).not.toContain('tres');
    expect(plus.toLowerCase()).not.toContain('três');
    expect(quota.toLowerCase()).toMatch(/3|three|trois|drei|tre|tres|três/);
    expect(fallback).not.toBe(plus);
    expect(fallback).not.toBe(quota);
  });

  it.each(SHIPPED_LANGUAGES)('%s makes trial, price, period and renewal explicit', (language) => {
    const catalogue = CATALOGUES[language];

    for (const key of COMMERCIAL_KEYS) {
      expect(catalogue[key]).toEqual(expect.any(String));
      expect(catalogue[key]).not.toContain(key);
    }

    const cta = catalogue['paywall.cta'];
    const trial = translate(language, 'paywall.plan.trial', { price: '39,99 €' });
    const terms = translate(language, 'paywall.terms.trial', { price: '39,99 €' });
    const renewal = catalogue['paywall.plan.renewal'];

    expect(cta.toLowerCase()).toMatch(/7/);
    expect(cta.toLowerCase()).not.toMatch(/continue|continuer|continua|continuar|weiter/);
    expect(trial).toContain('39,99 €');
    expect(terms).toContain('39,99 €');
    expect(terms.toLowerCase()).toMatch(/7/);
    expect(renewal.toLowerCase()).toMatch(
      /renew|renouv|renov|rinnova|renueva|verlängert|automat/
    );
    expect(renewal.toLowerCase()).toMatch(/cancel|annul|künd|cancel/);
  });

  it('does not leave leftover English on the commercial keys', () => {
    const commercial = COMMERCIAL_KEYS.filter((key) => key !== 'paywall.legal');
    for (const language of SHIPPED_LANGUAGES.filter((item) => item !== 'en')) {
      const leftover = commercial.filter((key) => CATALOGUES[language][key] === en[key]);
      expect(leftover).toEqual([]);
    }
  });
});
