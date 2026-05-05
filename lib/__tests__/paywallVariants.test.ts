import { getPaywallVariant } from '@/lib/paywallVariants';
import { getTranslator, loadTranslations } from '@/lib/i18n';

const variantKeys = [
  'subscription.paywall.variant.analysis_limit.title',
  'subscription.paywall.variant.analysis_limit.cta',
  'subscription.paywall.variant.exploration_limit.title',
  'subscription.paywall.variant.exploration_limit.cta',
  'subscription.paywall.variant.returning_device.title',
  'subscription.paywall.button.continue_free',
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
    });
  });

  it('has English and French copy for the primary variant keys', async () => {
    await Promise.all([loadTranslations('en'), loadTranslations('fr')]);

    for (const language of ['en', 'fr'] as const) {
      const t = getTranslator(language);
      for (const key of variantKeys) {
        expect(t(key)).not.toBe(key);
      }
    }
  });
});
