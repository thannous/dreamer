export type DreamStatsInsightKind =
  | 'record'
  | 'analyze'
  | 'explore'
  | 'favorite'
  | 'streak'
  | 'steady';

export type DreamStatsInsightRoute = '/recording' | '/(tabs)/journal';

export type DreamStatsInsightInput = {
  totalDreams: number;
  favoriteDreams: number;
  currentStreak: number;
  analyzedDreams: number;
  dreamsWithChat: number;
};

export type DreamStatsInsight = {
  kind: DreamStatsInsightKind;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  route: DreamStatsInsightRoute;
  analysisRatio: number;
  explorationRatio: number;
  streakGoalRatio: number;
};

const STREAK_GOAL_DAYS = 3;

function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, part / total));
}

function insightFor(kind: DreamStatsInsightKind): Pick<DreamStatsInsight, 'kind' | 'titleKey' | 'bodyKey' | 'ctaKey' | 'route'> {
  const baseKey = `stats.insight.${kind}`;
  return {
    kind,
    titleKey: `${baseKey}.title`,
    bodyKey: `${baseKey}.body`,
    ctaKey: `${baseKey}.cta`,
    route: kind === 'record' ? '/recording' : '/(tabs)/journal',
  };
}

export function getDreamStatsInsight(stats: DreamStatsInsightInput): DreamStatsInsight {
  const analysisRatio = ratio(stats.analyzedDreams, stats.totalDreams);
  const explorationRatio = ratio(stats.dreamsWithChat, stats.totalDreams);
  const streakGoalRatio = ratio(stats.currentStreak, STREAK_GOAL_DAYS);

  let kind: DreamStatsInsightKind = 'steady';
  if (stats.totalDreams === 0) {
    kind = 'record';
  } else if (stats.analyzedDreams < stats.totalDreams) {
    kind = 'analyze';
  } else if (stats.dreamsWithChat < stats.analyzedDreams) {
    kind = 'explore';
  } else if (stats.favoriteDreams === 0 && stats.totalDreams >= 3) {
    kind = 'favorite';
  } else if (stats.currentStreak >= STREAK_GOAL_DAYS) {
    kind = 'streak';
  }

  return {
    ...insightFor(kind),
    analysisRatio,
    explorationRatio,
    streakGoalRatio,
  };
}
