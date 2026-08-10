import { SUPPORTED_APP_LANGUAGES } from '@/lib/language';
import { getPaywallVariant, PLUS_PAYWALL_FEATURE_KEYS } from '@/lib/paywallVariants';
import { getTranslator, loadTranslations } from '@/lib/i18n';

const variantKeys = [
  'subscription.paywall.variant.analysis_limit.title',
  'subscription.paywall.variant.analysis_limit.subtitle',
  'subscription.paywall.variant.analysis_limit.card_title',
  'subscription.paywall.variant.analysis_limit.card_subtitle',
  'subscription.paywall.variant.analysis_limit.feature_1',
  'subscription.paywall.variant.analysis_limit.feature_2',
  'subscription.paywall.variant.analysis_limit.feature_3',
  'subscription.paywall.variant.analysis_limit.cta',
  'subscription.paywall.variant.analysis_cta.title',
  'subscription.paywall.variant.exploration_limit.title',
  'subscription.paywall.variant.exploration_limit.card_title',
  'subscription.paywall.variant.exploration_limit.cta',
  'subscription.paywall.variant.stats_profile.chip',
  'subscription.paywall.variant.stats_profile.title',
  'subscription.paywall.variant.stats_profile.subtitle',
  'subscription.paywall.variant.stats_profile.card_title',
  'subscription.paywall.variant.stats_profile.card_subtitle',
  'subscription.paywall.variant.stats_profile.feature_1',
  'subscription.paywall.variant.stats_profile.feature_2',
  'subscription.paywall.variant.stats_profile.feature_3',
  'subscription.paywall.variant.stats_profile.cta',
  'subscription.paywall.variant.settings.title',
  'subscription.paywall.variant.settings_quota.title',
  'subscription.paywall.variant.returning_device.title',
  'subscription.paywall.card.title',
  'subscription.paywall.card.subtitle',
  'subscription.paywall.free_context',
  'subscription.paywall.reassurance',
  'subscription.paywall.comparison.free',
  'subscription.paywall.comparison.plus',
  'subscription.paywall.comparison.analysis',
  'subscription.paywall.comparison.exploration',
  'subscription.paywall.comparison.synthesis',
  'subscription.paywall.comparison.recording',
  'subscription.paywall.comparison.limited',
  'subscription.paywall.comparison.unlimited',
  'subscription.paywall.comparison.unlimited_recording',
  'subscription.paywall.comparison.essential',
  'subscription.paywall.comparison.deep',
  'subscription.paywall.button.continue_free',
  'subscription.paywall.button.continue_free_hint',
  ...PLUS_PAYWALL_FEATURE_KEYS,
] as const;

const recurrencePatternByLanguage = {
  en: /repeat|recurr|coming back/i,
  fr: /revien|r[ée]p[èe]t|r[ée]curr/i,
  es: /repit|repet|recurr/i,
  de: /wiederkehr|wiederhol/i,
  it: /torn|ripet|ricorr/i,
  pt: /repit|recorr|volt/i,
} as const;

describe('paywallVariants', () => {
  it('returns moment-led copy keys for limit and exploration triggers', () => {
    expect(getPaywallVariant('analysis_limit')).toMatchObject({
      trigger: 'analysis_limit',
      headerTitleKey: 'subscription.paywall.variant.analysis_limit.title',
      primaryLabelKey: 'subscription.paywall.variant.analysis_limit.cta',
    });

    expect(getPaywallVariant('exploration_limit')).toMatchObject({
      trigger: 'exploration_limit',
      headerTitleKey: 'subscription.paywall.variant.exploration_limit.title',
      primaryLabelKey: 'subscription.paywall.variant.exploration_limit.cta',
    });
  });

  it('keeps direct paywall browsing on the generic plan copy', () => {
    expect(getPaywallVariant('direct')).toMatchObject({
      trigger: 'direct',
      headerTitleKey: 'subscription.paywall.header.free',
      primaryLabelKey: 'subscription.paywall.button.primary.free',
      featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    });
  });

  it('uses stats-specific copy for the dream profile gate', () => {
    expect(getPaywallVariant('stats_profile')).toMatchObject({
      trigger: 'stats_profile',
      chipKey: 'subscription.paywall.variant.stats_profile.chip',
      headerTitleKey: 'subscription.paywall.variant.stats_profile.title',
      primaryLabelKey: 'subscription.paywall.variant.stats_profile.cta',
    });

    // A paywall opened from Stats must not fall back to the generic plan copy —
    // that is the attribution/context gap the audit reported.
    expect(getPaywallVariant('stats_profile').featureKeys).not.toEqual(PLUS_PAYWALL_FEATURE_KEYS);
  });

  it('uses concise Plus benefits for settings-triggered plan browsing', () => {
    expect(getPaywallVariant('settings')).toMatchObject({
      trigger: 'settings',
      headerTitleKey: 'subscription.paywall.variant.settings.title',
      featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    });

    expect(getPaywallVariant('settings_quota')).toMatchObject({
      trigger: 'settings_quota',
      headerTitleKey: 'subscription.paywall.variant.settings_quota.title',
      featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    });
  });

  it('has localized copy for the primary variant and benefit keys', async () => {
    await Promise.all(SUPPORTED_APP_LANGUAGES.map((language) => loadTranslations(language)));

    for (const language of SUPPORTED_APP_LANGUAGES) {
      const t = getTranslator(language);
      for (const key of variantKeys) {
        expect(t(key)).not.toBe(key);
      }
    }
  });

  it('[B] Given the stats_profile paywall When its copy is read Then no language still promises recurring symbols', async () => {
    // Every other assertion in this file checks key EXISTENCE only, so a half-applied copy
    // rewrite — en updated, de still promising "Symbole" — ships green here AND under the
    // key-parity test, which is about keys, not values. Recurring symbols are out of scope
    // for this phase (the spike found they do not concentrate below ~50 dreams), so the
    // paywall must stop selling them.
    // Negative half only: it is the false promise, not the missing one, that damages trust.
    // Revert: leave de.ts unrewritten — the German feature string fails by language and key.
    await Promise.all(SUPPORTED_APP_LANGUAGES.map((language) => loadTranslations(language)));

    const promiseKeys = [
      'subscription.paywall.variant.stats_profile.subtitle',
      'subscription.paywall.variant.stats_profile.card_subtitle',
      'subscription.paywall.variant.stats_profile.feature_1',
      'subscription.paywall.variant.stats_profile.feature_2',
      'subscription.paywall.variant.stats_profile.feature_3',
    ];

    for (const language of SUPPORTED_APP_LANGUAGES) {
      const t = getTranslator(language);

      for (const key of promiseKeys) {
        expect({ language, key, value: t(key) }).toEqual({
          language,
          key,
          value: expect.not.stringMatching(/symbol|símbolo|simbol/i),
        });
      }
    }
  });

  it('[B] Given detected emotion families When the stats paywall renders Then no language promises recurrence', async () => {
    await Promise.all(SUPPORTED_APP_LANGUAGES.map((language) => loadTranslations(language)));

    const promiseKeys = [
      'subscription.paywall.variant.stats_profile.title',
      'subscription.paywall.variant.stats_profile.subtitle',
    ];

    for (const language of SUPPORTED_APP_LANGUAGES) {
      const t = getTranslator(language);

      for (const key of promiseKeys) {
        expect({ language, key, value: t(key) }).toEqual({
          language,
          key,
          value: expect.not.stringMatching(recurrencePatternByLanguage[language]),
        });
      }
    }
  });
});
