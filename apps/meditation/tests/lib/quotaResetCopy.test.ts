import { formatQuotaResetDate, freeQuotaResetDay } from '@/lib/entitlements';
import { translate } from '@/lib/i18n';
import { SHIPPED_LANGUAGES, type AppLanguage } from '@/lib/types';

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

  it('keeps remaining copy separate from the commercial action in every language', () => {
    for (const language of SHIPPED_LANGUAGES as readonly AppLanguage[]) {
      expect(translate(language, 'paywall.options')).not.toBe(
        translate(language, 'paywall.remaining.none')
      );
    }
  });
});
