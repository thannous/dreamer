import type { BadgeAction, BadgeFamily, BadgeFamilyId, BadgeTier, BadgeTierLevel } from '@/lib/badges/catalog';
import type { BadgeFamilyState } from '@/lib/badges/ledger';

import { tierOfLevel } from './badgeMaterials';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type FormatNumber = (value: number) => string;

export const badgeName = (t: Translate, id: BadgeFamilyId) => t(`badges.family.${id}.name`);
export const badgeRule = (t: Translate, id: BadgeFamilyId) => t(`badges.family.${id}.rule`);
export const badgeTierName = (t: Translate, tier: BadgeTier) => t(`badges.tier.${tier}`);
export const badgeActionLabel = (t: Translate, action: BadgeAction) => t(`badges.action.${action}`);

/** What a tier asks, in the family's own words: « 25 rêves gardés ». */
export function badgeGoal(t: Translate, family: BadgeFamily, level: 1 | 2 | 3, formatNumber: FormatNumber): string {
  const count = family.thresholds[level - 1];
  return t(count === 1 ? `badges.family.${family.id}.goal_one` : `badges.family.${family.id}.goal`, {
    count: formatNumber(count),
  });
}

/** The line under a card's name: the tier held and, until gold, how far along the next one is. */
export function badgeStatus(t: Translate, state: BadgeFamilyState, formatNumber: FormatNumber): string {
  const tier = tierOfLevel(state.tier);
  if (state.nextThreshold == null) return tier ? badgeTierName(t, tier) : '';
  const progress = t('badges.card.progress', {
    count: formatNumber(Math.min(state.progress, state.nextThreshold)),
    goal: formatNumber(state.nextThreshold),
  });
  return tier ? `${badgeTierName(t, tier)} · ${progress}` : progress;
}

/** What a screen reader says for a card: its name, what is held, what comes next. */
export function badgeAccessibilityLabel(t: Translate, state: BadgeFamilyState, formatNumber: FormatNumber): string {
  const name = badgeName(t, state.family.id);
  const tier = tierOfLevel(state.tier);
  if (state.unrevealed > 0 && tier) {
    return t('badges.a11y.new_card', { name, tier: badgeTierName(t, tier) });
  }
  const held = tier ? t('badges.a11y.held', { tier: badgeTierName(t, tier) }) : t('badges.a11y.none');
  if (state.nextThreshold == null) return `${name}. ${held}. ${t('badges.a11y.complete')}`;
  const nextTier = tierOfLevel((state.tier + 1) as BadgeTierLevel)!;
  const next = t('badges.a11y.next', {
    count: formatNumber(Math.min(state.progress, state.nextThreshold)),
    goal: formatNumber(state.nextThreshold),
    tier: badgeTierName(t, nextTier),
  });
  return `${name}. ${held}. ${next}`;
}
