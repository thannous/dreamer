import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';

const dreamImageProgressKeys = [
  'journal.detail.image.preparing_title',
  'journal.detail.image.preparing_subtitle',
  'journal.detail.image.generating_title',
  'journal.detail.image.queued_subtitle',
  'journal.detail.image.running_subtitle',
  'journal.detail.image.generate_action',
  'journal.detail.image.quota_exceeded_message',
  'journal.detail.image.no_image_subtitle',
] as const;

const automaticStartPattern = /automat|automatically|se termine avant|before the illustration starts|antes de iniciar|bevor die Illustration startet|prima di avviare|antes de a ilustração/i;
const interpretationQuotaPattern = /interpretat|análisis|analisi|anályse|análises|Analysekontingent|quota de análise|quota di analisi|analysis quota/i;

describe('dream detail i18n', () => {
  const packs = { de, en, es, fr, it: italian, pt };

  it('has localized image generation progress labels in every supported language', () => {
    for (const translations of Object.values(packs)) {
      for (const key of dreamImageProgressKeys) {
        expect(translations[key]).toEqual(expect.any(String));
        expect(translations[key]).not.toBe(key);
        expect(translations[key].trim()).not.toBe('');
      }
    }
  });

  it('uses an independent illustration CTA and image-specific quota copy', () => {
    expect(fr['journal.detail.image.generate_action']).toBe('Illustrer mon rêve');

    for (const translations of Object.values(packs)) {
      expect(translations['journal.detail.image.no_image_subtitle']).not.toMatch(automaticStartPattern);
      expect(translations['journal.detail.image.preparing_subtitle']).not.toMatch(automaticStartPattern);
      expect(translations['journal.detail.image.ai_locked_note']).not.toMatch(automaticStartPattern);
      expect(translations['journal.detail.image.quota_exceeded_message']).not.toMatch(interpretationQuotaPattern);
      expect(translations['journal.detail.image.quota_exceeded_message'].toLowerCase()).toMatch(
        /illustra|ilustr/
      );
    }
  });
});
