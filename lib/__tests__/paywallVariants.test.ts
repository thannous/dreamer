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
  'subscription.paywall.variant.settings.title',
  'subscription.paywall.variant.settings_quota.title',
  'subscription.paywall.variant.returning_device.title',
  'subscription.paywall.card.title',
  'subscription.paywall.card.subtitle',
  'subscription.paywall.free_context',
  'subscription.paywall.button.continue_free',
  'subscription.paywall.button.continue_free_hint',
  ...PLUS_PAYWALL_FEATURE_KEYS,
] as const;

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

  it('uses living profile benefits for settings-triggered plan browsing', () => {
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
});
