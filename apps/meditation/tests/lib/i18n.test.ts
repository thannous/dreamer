import { de } from '@/lib/i18n/de';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { fr } from '@/lib/i18n/fr';
import { isAppLanguage, translate } from '@/lib/i18n';
import { it as itCatalogue } from '@/lib/i18n/it';
import { pt } from '@/lib/i18n/pt';
import { contentEn } from '@/lib/i18n/content.en';
import { contentDe } from '@/lib/i18n/content.de';
import { contentEs } from '@/lib/i18n/content.es';
import { contentFr } from '@/lib/i18n/content.fr';
import { contentIt } from '@/lib/i18n/content.it';
import { contentPt } from '@/lib/i18n/content.pt';
import { SHIPPED_LANGUAGES, type AppLanguage } from '@/lib/types';

describe('translate', () => {
  it('fills every placeholder it is given a value for', () => {
    expect(translate('en', 'common.step', { current: 2, total: 4 })).toBe('Step 2 of 4');
    expect(translate('fr', 'common.step', { current: 2, total: 4 })).toBe('Étape 2 sur 4');
  });

  it('accepts numbers as well as strings', () => {
    expect(translate('en', 'onboarding.intention.minutes', { count: 10 })).toBe('10 min');
    expect(translate('en', 'onboarding.reminder.hour', { time: '21:30' })).toBe('At 21:30');
  });

  it('leaves a placeholder untouched when no value is supplied', () => {
    expect(translate('en', 'common.step', { current: 2 })).toBe('Step 2 of {total}');
    expect(translate('en', 'common.step', {})).toBe('Step {current} of {total}');
    expect(translate('en', 'common.step')).toBe('Step {current} of {total}');
  });

  it('ignores values that match no placeholder', () => {
    expect(translate('en', 'welcome.cta', { current: 2 })).toBe(en['welcome.cta']);
  });

  it('serves each language from its own catalogue', () => {
    expect(translate('fr', 'welcome.cta')).toBe(fr['welcome.cta']);
    expect(translate('es', 'welcome.cta')).toBe(es['welcome.cta']);
    expect(translate('de', 'welcome.cta')).toBe(de['welcome.cta']);
    expect(translate('it', 'welcome.cta')).toBe(itCatalogue['welcome.cta']);
    expect(translate('pt', 'welcome.cta')).toBe(pt['welcome.cta']);
  });

  it('serves catalogue copy, not only interface chrome', () => {
    expect(translate('de', 'session.sleep-descent.title')).toBe(
      contentDe['session.sleep-descent.title']
    );
    expect(translate('de', 'session.sleep-descent.title')).not.toBe(
      contentEn['session.sleep-descent.title']
    );
  });

  it('falls back to English rather than leaking a raw key', () => {
    // Should an unknown language ever reach this far, a key on screen is the
    // one outcome that must not happen.
    expect(translate('xx' as AppLanguage, 'welcome.cta')).toBe(en['welcome.cta']);
  });
});

describe('catalogue completeness', () => {
  const CATALOGUES: Record<string, Record<string, string>> = {
    fr,
    es,
    de,
    it: itCatalogue,
    pt,
  };
  const CONTENT: Record<string, Record<string, string>> = {
    fr: contentFr,
    es: contentEs,
    de: contentDe,
    it: contentIt,
    pt: contentPt,
  };

  it.each(Object.keys(CATALOGUES))('%s covers every interface key', (language) => {
    const missing = Object.keys(en).filter((key) => !(key in CATALOGUES[language]));
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(CONTENT))('%s covers every catalogue key', (language) => {
    const missing = Object.keys(contentEn).filter((key) => !(key in CONTENT[language]));
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(CATALOGUES))('%s carries no leftover English', (language) => {
    // A handful of strings are legitimately identical across languages —
    // product names, "Plus", "Pause", "4-7-8". Anything beyond that many
    // usually means a forgotten copy-paste.
    const identical = Object.keys(en).filter((key) => CATALOGUES[language][key] === en[key as keyof typeof en]);
    expect(identical.length).toBeLessThan(25);
  });

  /** Placeholders are contractual: a lost `{count}` renders a sentence wrong. */
  it.each(Object.keys(CATALOGUES))('%s keeps every placeholder', (language) => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort().join(',');
    const broken = Object.keys(en).filter(
      (key) => placeholders(en[key as keyof typeof en]) !== placeholders(CATALOGUES[language][key])
    );
    expect(broken).toEqual([]);
  });
});

describe('isAppLanguage', () => {
  it.each(SHIPPED_LANGUAGES)('accepts %s', (language) => {
    expect(isAppLanguage(language)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAppLanguage('xx')).toBe(false);
    expect(isAppLanguage('')).toBe(false);
  });
});
