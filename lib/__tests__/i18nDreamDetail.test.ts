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

  it('does not promise an image from analysis or reflection actions', () => {
    const analysisImagePromise = /imagen|illustration|image|imagery|visual idea|ideia visual|erstes bild|traumbild|onirique/i;
    for (const translations of Object.values(packs)) {
      expect(translations['journal.detail.action.analyze.message']).not.toMatch(analysisImagePromise);
      expect(translations['journal.detail.action.explore.message']).not.toMatch(analysisImagePromise);
      expect(translations['journal.detail.image_replace.subtitle']).toMatch(/optional|optionnelle|opcional|separat/i);
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

  it('exposes quota-before-action and retry-chat copy in every language', () => {
    const keys = [
      'journal.detail.quota_hint.remaining',
      'journal.detail.quota_hint.unknown',
      'journal.detail.quota_hint.unlimited',
      'journal.detail.quota_hint.quota.analysis',
      'journal.detail.quota_hint.quota.message',
      'journal.detail.quota_hint.quota.synthesis360',
      'journal.detail.action.retry_chat.title',
      'journal.detail.action.retry_chat.message',
      'journal.detail.action.retry_chat.cta',
      'dream_chat.retry_target.label',
      'dream_chat.retry_target.cta',
    ] as const;

    for (const translations of Object.values(packs)) {
      for (const key of keys) {
        expect(translations[key]).toEqual(expect.any(String));
        expect(translations[key]).not.toBe(key);
        expect(translations[key].trim()).not.toBe('');
      }
      expect(translations['journal.detail.quota_hint.remaining']).toMatch(/\{quota\}/);
      expect(translations['journal.detail.quota_hint.remaining']).toMatch(/\{remaining\}/);
      expect(translations['journal.detail.quota_hint.unknown']).toMatch(/\{quota\}/);
    }

    expect(fr['journal.detail.quota_hint.remaining']).toBe('Utilise 1 {quota} · il en reste {remaining}');
    expect(de['journal.detail.quota_hint.remaining']).toBe('Verbraucht 1 {quota} · noch {remaining} übrig');
    expect(italian['journal.detail.quota_hint.remaining']).toBe('Usa 1 {quota} · ne restano {remaining}');
    expect(en['journal.detail.quota_hint.unknown']).toBe(
      'Uses 1 {quota}. Remaining credits will be checked before starting.'
    );
    expect(fr['journal.detail.quota_hint.unknown']).toBe(
      'Utilise 1 {quota}. Les crédits restants seront vérifiés avant de lancer.'
    );
    expect(de['journal.detail.quota_hint.unknown']).toBe(
      'Verbraucht 1 {quota}. Das restliche Kontingent wird vor dem Start geprüft.'
    );
    expect(es['journal.detail.quota_hint.unknown']).toBe(
      'Usa 1 {quota}. El saldo restante se comprobará antes de empezar.'
    );
    expect(italian['journal.detail.quota_hint.unknown']).toBe(
      'Usa 1 {quota}. Il credito rimanente verrà verificato prima di iniziare.'
    );
    expect(pt['journal.detail.quota_hint.unknown']).toBe(
      'Usa 1 {quota}. O saldo restante será verificado antes de começar.'
    );
  });

  it('promises a lossless local-to-account copy in every language, without claiming live sync', () => {
    const futureCopy = /will be copied|seront copiés|werden .* kopiert|se copiarán|verranno copiati|serão copiados/i;
    const noLoss = /without loss|sans perte|ohne Verlust|sin pérdidas|senza perdite|sem perdas/i;
    const noDuplicate = /duplicate|doublon|Duplikate|duplicados|duplicati/i;
    const liveSyncClaim = /already sync|déjà synchron|bereits synchron|ya se sincron|già sincron|já sincron|You're signed in and syncing|Vous êtes connecté et vos données se synchronisent/i;

    for (const translations of Object.values(packs)) {
      const copy = translations['settings.account.description_signed_out'];
      expect(copy).toEqual(expect.any(String));
      expect(copy).not.toBe('settings.account.description_signed_out');
      expect(copy).toMatch(futureCopy);
      expect(copy).toMatch(noLoss);
      expect(copy).toMatch(noDuplicate);
      expect(copy).not.toMatch(liveSyncClaim);
      expect(copy.toLowerCase()).toMatch(/device|appareil|gerät|dispositivo/);
    }
  });
});
