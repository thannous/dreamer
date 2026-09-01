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
  'journal.detail.image.expand_accessibility',
  'journal.detail.image.close_fullscreen',
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

  it('exposes the three explicit detail zones in every language', () => {
    const expected = {
      de: { dream: 'Mein Traum', reading: 'Noctalia-Analyse', reflection: 'Meine Reflexion' },
      en: { dream: 'My dream', reading: 'Noctalia analysis', reflection: 'My reflection' },
      es: { dream: 'Mi sueño', reading: 'Análisis Noctalia', reflection: 'Mi reflexión' },
      fr: { dream: 'Mon rêve', reading: 'Analyse Noctalia', reflection: 'Ma réflexion' },
      it: { dream: 'Il mio sogno', reading: 'Analisi Noctalia', reflection: 'La mia riflessione' },
      pt: { dream: 'Meu sonho', reading: 'Análise Noctalia', reflection: 'Minha reflexão' },
    } as const;

    for (const [lang, translations] of Object.entries(packs)) {
      const copy = expected[lang as keyof typeof expected];
      expect(translations['journal.detail.zone.dream']).toBe(copy.dream);
      expect(translations['journal.detail.zone.reading']).toBe(copy.reading);
      expect(translations['journal.detail.zone.reflection']).toBe(copy.reflection);
    }
  });
});
