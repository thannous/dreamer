import type { PaywallTrigger } from '@/lib/analytics';

export type PaywallVariant = {
  trigger: PaywallTrigger;
  chipKey: string;
  headerTitleKey: string;
  headerSubtitleKey: string;
  cardTitleKey: string;
  cardSubtitleKey: string;
  featureKeys: readonly string[];
  primaryLabelKey: string;
};

export const PLUS_PAYWALL_FEATURE_KEYS = [
  'subscription.paywall.card.feature.unlimited_analyses',
  'subscription.paywall.card.feature.unlimited_explorations',
  'subscription.paywall.card.feature.final_synthesis',
] as const;

const variants: Record<PaywallTrigger, PaywallVariant> = {
  analysis_limit: {
    trigger: 'analysis_limit',
    chipKey: 'subscription.paywall.variant.analysis_limit.chip',
    headerTitleKey: 'subscription.paywall.variant.analysis_limit.title',
    headerSubtitleKey: 'subscription.paywall.variant.analysis_limit.subtitle',
    cardTitleKey: 'subscription.paywall.variant.analysis_limit.card_title',
    cardSubtitleKey: 'subscription.paywall.variant.analysis_limit.card_subtitle',
    featureKeys: [
      'subscription.paywall.variant.analysis_limit.feature_1',
      'subscription.paywall.variant.analysis_limit.feature_2',
      'subscription.paywall.variant.analysis_limit.feature_3',
    ],
    primaryLabelKey: 'subscription.paywall.variant.analysis_limit.cta',
  },
  analysis_cta: {
    trigger: 'analysis_cta',
    chipKey: 'subscription.paywall.variant.analysis_cta.chip',
    headerTitleKey: 'subscription.paywall.variant.analysis_cta.title',
    headerSubtitleKey: 'subscription.paywall.variant.analysis_cta.subtitle',
    cardTitleKey: 'subscription.paywall.variant.analysis_cta.card_title',
    cardSubtitleKey: 'subscription.paywall.variant.analysis_cta.card_subtitle',
    featureKeys: [
      'subscription.paywall.variant.analysis_cta.feature_1',
      'subscription.paywall.variant.analysis_cta.feature_2',
      'subscription.paywall.variant.analysis_cta.feature_3',
    ],
    primaryLabelKey: 'subscription.paywall.variant.analysis_cta.cta',
  },
  exploration_limit: {
    trigger: 'exploration_limit',
    chipKey: 'subscription.paywall.variant.exploration_limit.chip',
    headerTitleKey: 'subscription.paywall.variant.exploration_limit.title',
    headerSubtitleKey: 'subscription.paywall.variant.exploration_limit.subtitle',
    cardTitleKey: 'subscription.paywall.variant.exploration_limit.card_title',
    cardSubtitleKey: 'subscription.paywall.variant.exploration_limit.card_subtitle',
    featureKeys: [
      'subscription.paywall.variant.exploration_limit.feature_1',
      'subscription.paywall.variant.exploration_limit.feature_2',
      'subscription.paywall.variant.exploration_limit.feature_3',
    ],
    primaryLabelKey: 'subscription.paywall.variant.exploration_limit.cta',
  },
  image_generation: {
    trigger: 'image_generation',
    chipKey: 'subscription.paywall.variant.image_generation.chip',
    headerTitleKey: 'subscription.paywall.variant.image_generation.title',
    headerSubtitleKey: 'subscription.paywall.variant.image_generation.subtitle',
    cardTitleKey: 'subscription.paywall.variant.image_generation.card_title',
    cardSubtitleKey: 'subscription.paywall.variant.image_generation.card_subtitle',
    featureKeys: [
      'subscription.paywall.variant.image_generation.feature_1',
      'subscription.paywall.variant.image_generation.feature_2',
      'subscription.paywall.variant.image_generation.feature_3',
    ],
    primaryLabelKey: 'subscription.paywall.variant.image_generation.cta',
  },
  returning_device: {
    trigger: 'returning_device',
    chipKey: 'subscription.paywall.variant.returning_device.chip',
    headerTitleKey: 'subscription.paywall.variant.returning_device.title',
    headerSubtitleKey: 'subscription.paywall.variant.returning_device.subtitle',
    cardTitleKey: 'subscription.paywall.variant.returning_device.card_title',
    cardSubtitleKey: 'subscription.paywall.variant.returning_device.card_subtitle',
    featureKeys: [
      'subscription.paywall.variant.returning_device.feature_1',
      'subscription.paywall.variant.returning_device.feature_2',
      'subscription.paywall.variant.returning_device.feature_3',
    ],
    primaryLabelKey: 'subscription.paywall.variant.returning_device.cta',
  },
  settings_quota: {
    trigger: 'settings_quota',
    chipKey: 'subscription.paywall.variant.settings_quota.chip',
    headerTitleKey: 'subscription.paywall.variant.settings_quota.title',
    headerSubtitleKey: 'subscription.paywall.variant.settings_quota.subtitle',
    cardTitleKey: 'subscription.paywall.card.title',
    cardSubtitleKey: 'subscription.paywall.card.subtitle',
    featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    primaryLabelKey: 'subscription.paywall.variant.settings_quota.cta',
  },
  settings: {
    trigger: 'settings',
    chipKey: 'subscription.paywall.variant.settings.chip',
    headerTitleKey: 'subscription.paywall.variant.settings.title',
    headerSubtitleKey: 'subscription.paywall.variant.settings.subtitle',
    cardTitleKey: 'subscription.paywall.card.title',
    cardSubtitleKey: 'subscription.paywall.card.subtitle',
    featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    primaryLabelKey: 'subscription.paywall.variant.settings.cta',
  },
  restore: {
    trigger: 'restore',
    chipKey: 'subscription.paywall.variant.restore.chip',
    headerTitleKey: 'subscription.paywall.variant.restore.title',
    headerSubtitleKey: 'subscription.paywall.variant.restore.subtitle',
    cardTitleKey: 'subscription.paywall.card.title',
    cardSubtitleKey: 'subscription.paywall.card.subtitle',
    featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    primaryLabelKey: 'subscription.paywall.variant.restore.cta',
  },
  direct: {
    trigger: 'direct',
    chipKey: 'subscription.paywall.variant.direct.chip',
    headerTitleKey: 'subscription.paywall.header.free',
    headerSubtitleKey: 'subscription.paywall.header.subtitle.free',
    cardTitleKey: 'subscription.paywall.card.title',
    cardSubtitleKey: 'subscription.paywall.card.subtitle',
    featureKeys: PLUS_PAYWALL_FEATURE_KEYS,
    primaryLabelKey: 'subscription.paywall.button.primary.free',
  },
};

export function getPaywallVariant(trigger: PaywallTrigger): PaywallVariant {
  return variants[trigger] ?? variants.direct;
}
