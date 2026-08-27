import { formatQuotaResetDate, freeQuotaResetDay } from '@/lib/entitlements';
import { translate } from '@/lib/i18n';
import { SHIPPED_LANGUAGES, type AppLanguage } from '@/lib/types';

const SEPTEMBER = freeQuotaResetDay('2026-08-26');
const JANUARY = freeQuotaResetDay('2026-12-31');

describe('quota reset copy', () => {
  it('covers the six languages without leaking an ISO date', () => {
    for (const language of SHIPPED_LANGUAGES) {
      const date = formatQuotaResetDate(JANUARY, language);
      const copy = translate(language, 'paywall.reset', { date });
      const options = translate(language, 'paywall.options');

      expect(date).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(copy).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(copy).toContain(date);
      expect(options.length).toBeGreaterThan(0);
      expect(options.toLowerCase()).toMatch(/plus/);
    }
  });

  it('keeps the English and French labels explicit around December to January', () => {
    expect(SEPTEMBER).toBe('2026-09-01');
    expect(JANUARY).toBe('2027-01-01');
    expect(translate('en', 'paywall.reset', { date: formatQuotaResetDate(JANUARY, 'en') })).toBe(
      'Resets on 1 January 2027'
    );
    expect(translate('fr', 'paywall.reset', { date: formatQuotaResetDate(JANUARY, 'fr') })).toBe(
      'Réinitialisé le 1 janvier 2027'
    );
    expect(translate('en', 'paywall.options')).toBe('See Plus options');
    expect(translate('fr', 'paywall.options')).toBe('Voir les options Plus');
  });

  it('keeps remaining copy separate from the commercial action in every language', () => {
    for (const language of SHIPPED_LANGUAGES as readonly AppLanguage[]) {
      expect(translate(language, 'paywall.options')).not.toBe(
        translate(language, 'paywall.remaining.none')
      );
    }
  });
});
