import type { PaywallTrigger } from '@/lib/analytics';

/**
 * The words that change with the path that opened the offer. The comparison table
 * and the plans below them are the same for everyone.
 */
export type PaywallVariant = {
  trigger: PaywallTrigger;
  chipKey: string;
  headerTitleKey: string;
  headerSubtitleKey: string;
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
    primaryLabelKey: 'subscription.paywall.variant.analysis_limit.cta',
  },
  analysis_cta: {
    trigger: 'analysis_cta',
    chipKey: 'subscription.paywall.variant.analysis_cta.chip',
    headerTitleKey: 'subscription.paywall.variant.analysis_cta.title',
    headerSubtitleKey: 'subscription.paywall.variant.analysis_cta.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.analysis_cta.cta',
  },
  exploration_limit: {
    trigger: 'exploration_limit',
    chipKey: 'subscription.paywall.variant.exploration_limit.chip',
    headerTitleKey: 'subscription.paywall.variant.exploration_limit.title',
    headerSubtitleKey: 'subscription.paywall.variant.exploration_limit.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.exploration_limit.cta',
  },
  chat_limit: {
    trigger: 'chat_limit',
    chipKey: 'subscription.paywall.variant.chat_limit.chip',
    headerTitleKey: 'subscription.paywall.variant.chat_limit.title',
    headerSubtitleKey: 'subscription.paywall.variant.chat_limit.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.chat_limit.cta',
  },
  image_generation: {
    trigger: 'image_generation',
    chipKey: 'subscription.paywall.variant.image_generation.chip',
    headerTitleKey: 'subscription.paywall.variant.image_generation.title',
    headerSubtitleKey: 'subscription.paywall.variant.image_generation.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.image_generation.cta',
  },
  stats_profile: {
    trigger: 'stats_profile',
    chipKey: 'subscription.paywall.variant.stats_profile.chip',
    headerTitleKey: 'subscription.paywall.variant.stats_profile.title',
    headerSubtitleKey: 'subscription.paywall.variant.stats_profile.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.stats_profile.cta',
  },
  returning_device: {
    trigger: 'returning_device',
    chipKey: 'subscription.paywall.variant.returning_device.chip',
    headerTitleKey: 'subscription.paywall.variant.returning_device.title',
    headerSubtitleKey: 'subscription.paywall.variant.returning_device.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.returning_device.cta',
  },
  settings_quota: {
    trigger: 'settings_quota',
    chipKey: 'subscription.paywall.variant.settings_quota.chip',
    headerTitleKey: 'subscription.paywall.variant.settings_quota.title',
    headerSubtitleKey: 'subscription.paywall.variant.settings_quota.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.settings_quota.cta',
  },
  settings: {
    trigger: 'settings',
    chipKey: 'subscription.paywall.variant.settings.chip',
    headerTitleKey: 'subscription.paywall.variant.settings.title',
    headerSubtitleKey: 'subscription.paywall.variant.settings.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.settings.cta',
  },
  restore: {
    trigger: 'restore',
    chipKey: 'subscription.paywall.variant.restore.chip',
    headerTitleKey: 'subscription.paywall.variant.restore.title',
    headerSubtitleKey: 'subscription.paywall.variant.restore.subtitle',
    primaryLabelKey: 'subscription.paywall.variant.restore.cta',
  },
  direct: {
    trigger: 'direct',
    chipKey: 'subscription.paywall.variant.direct.chip',
    headerTitleKey: 'subscription.paywall.header.free',
    headerSubtitleKey: 'subscription.paywall.header.subtitle.free',
    primaryLabelKey: 'subscription.paywall.button.primary.free',
  },
};

export function getPaywallVariant(trigger: PaywallTrigger): PaywallVariant {
  return variants[trigger] ?? variants.direct;
}
