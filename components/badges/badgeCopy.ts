import { BADGE_CARD_COUNT, isFirstCard, type BadgeAction, type BadgeFamily, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';
import type { BadgeFamilyState } from '@/lib/badges/ledger';
import type { TranslateFunction as Translate } from '@/lib/errors';

import { finishOf, type BadgeFinish } from './badgeMaterials';

type FormatNumber = (value: number) => string;

export const badgeName = (t: Translate, id: BadgeFamilyId) => t(`badges.family.${id}.name`);
export const badgeRule = (t: Translate, id: BadgeFamilyId) => t(`badges.family.${id}.rule`);
export const badgeTierName = (t: Translate, tier: BadgeFinish) => t(`badges.tier.${tier}`);
export const badgeActionLabel = (t: Translate, action: BadgeAction) => t(`badges.action.${action}`);

/** How many cards are held, out of the whole collection. */
export function badgeHeldText(t: Translate, earned: number, formatNumber: FormatNumber): string {
  return t(earned === 0 ? 'badges.summary_zero' : earned === 1 ? 'badges.summary_one' : 'badges.summary', {
    count: formatNumber(earned),
    total: formatNumber(BADGE_CARD_COUNT),
  });
}

/** How many earned cards wait to be turned over. */
export function badgeNewCardsText(t: Translate, unrevealed: number, formatNumber: FormatNumber): string {
  return t(unrevealed === 1 ? 'badges.new_cards_one' : 'badges.new_cards', { count: formatNumber(unrevealed) });
}

/** How far along the next tier is: « 3 / 25 ». Empty once complete. */
export function badgeProgressText(t: Translate, state: BadgeFamilyState, formatNumber: FormatNumber): string {
  if (state.nextThreshold == null) return '';
  return t('badges.card.progress', {
    count: formatNumber(Math.min(state.progress, state.nextThreshold)),
    goal: formatNumber(state.nextThreshold),
  });
}

/** What a tier asks, in the family's own words: « 25 rêves gardés ». */
export function badgeGoal(t: Translate, family: BadgeFamily, level: number, formatNumber: FormatNumber): string {
  const count = family.thresholds[level - 1];
  return t(count === 1 ? `badges.family.${family.id}.goal_one` : `badges.family.${family.id}.goal`, {
    count: formatNumber(count),
  });
}

/**
 * The line under a card's name: the tier held and, until the last, how far along the next one
 * is. A card earned once says only whether it was discovered.
 */
export function badgeStatus(t: Translate, state: BadgeFamilyState, formatNumber: FormatNumber): string {
  if (isFirstCard(state.family)) return t(state.tier ? 'badges.card.discovered' : 'badges.card.to_discover');
  const tier = finishOf(state.family, state.tier);
  if (state.nextThreshold == null) return tier ? `${badgeTierName(t, tier)} · ${t('badges.card.complete')}` : '';
  const progress = badgeProgressText(t, state, formatNumber);
  return tier ? `${badgeTierName(t, tier)} · ${progress}` : progress;
}

/** What a screen reader says for a card waiting face down: its tier, or a discovery. */
export function badgeNewCardLabel(t: Translate, family: BadgeFamily, tier: BadgeFinish): string {
  const name = badgeName(t, family.id);
  return tier === 'discovery' ? t('badges.a11y.new_discovery', { name }) : t('badges.a11y.new_card', { name, tier: badgeTierName(t, tier) });
}

/** What a screen reader says for a card: its name, what is held, what comes next. */
export function badgeAccessibilityLabel(t: Translate, state: BadgeFamilyState, formatNumber: FormatNumber): string {
  const name = badgeName(t, state.family.id);
  const tier = finishOf(state.family, state.tier);
  if (state.unrevealed > 0 && tier) return badgeNewCardLabel(t, state.family, tier);
  if (isFirstCard(state.family)) return `${name}. ${t(tier ? 'badges.a11y.discovered' : 'badges.a11y.to_discover')}`;
  const held = tier ? t('badges.a11y.held', { tier: badgeTierName(t, tier) }) : t('badges.a11y.none');
  if (state.nextThreshold == null) return `${name}. ${held}. ${t('badges.a11y.complete')}`;
  const nextTier = finishOf(state.family, (state.tier + 1) as BadgeTierLevel)!;
  const next = t('badges.a11y.next', {
    count: formatNumber(Math.min(state.progress, state.nextThreshold)),
    goal: formatNumber(state.nextThreshold),
    tier: badgeTierName(t, nextTier),
  });
  return `${name}. ${held}. ${next}`;
}
