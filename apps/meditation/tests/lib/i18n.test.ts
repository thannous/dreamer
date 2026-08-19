import { en } from '@/lib/i18n/en';
import { fr } from '@/lib/i18n/fr';
import { isShippedLanguage, resolveLanguage, translate } from '@/lib/i18n';
import type { AppLanguage } from '@/lib/types';

/** The four locales that land in L8 and have no catalogue yet. */
const UNSHIPPED: AppLanguage[] = ['es', 'de', 'it', 'pt'];

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

  it('serves French from the French catalogue', () => {
    expect(translate('fr', 'welcome.cta')).toBe(fr['welcome.cta']);
    expect(translate('fr', 'welcome.cta')).not.toBe(en['welcome.cta']);
  });

  // Falling back to English is the point: an unshipped locale must never leak
  // a raw key like `welcome.cta` into the interface.
  it.each(UNSHIPPED)('falls back to English for %s', (language) => {
    expect(translate(language, 'welcome.cta')).toBe(en['welcome.cta']);
    expect(translate(language, 'onboarding.goals.title')).toBe(en['onboarding.goals.title']);
  });

  it('still interpolates through the fallback', () => {
    expect(translate('de', 'common.step', { current: 1, total: 4 })).toBe('Step 1 of 4');
  });
});

describe('resolveLanguage', () => {
  it('keeps the shipped languages', () => {
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('fr')).toBe('fr');
  });

  it.each(UNSHIPPED)('resolves %s onto English', (language) => {
    expect(resolveLanguage(language)).toBe('en');
  });

  it('recognises exactly the two shipped codes', () => {
    expect(isShippedLanguage('en')).toBe(true);
    expect(isShippedLanguage('fr')).toBe(true);
    expect(isShippedLanguage('es')).toBe(false);
    expect(isShippedLanguage('EN')).toBe(false);
    expect(isShippedLanguage('')).toBe(false);
  });
});

describe('catalogues', () => {
  it('translates every English key into French', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps the same placeholders on both sides', () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(fr[key])).toEqual(placeholders(en[key]));
    }
  });
});
