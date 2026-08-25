/** Six languages, as in the Noctalia journal app. */
export type AppLanguage = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt';

/** All six ship. Kept as a runtime list for the language picker to iterate. */
export const SHIPPED_LANGUAGES = [
  'en',
  'fr',
  'es',
  'de',
  'it',
  'pt',
] as const satisfies readonly AppLanguage[];
export type ShippedLanguage = (typeof SHIPPED_LANGUAGES)[number];

export type PracticeGoal =
  | 'sleep'
  | 'stress'
  | 'focus'
  | 'anxiety'
  | 'gratitude'
  | 'dream-prep';

export const PRACTICE_GOALS: PracticeGoal[] = [
  'sleep',
  'stress',
  'focus',
  'anxiety',
  'gratitude',
  'dream-prep',
];

export type ExperienceLevel = 'beginner' | 'occasional' | 'regular';

export const EXPERIENCE_LEVELS: ExperienceLevel[] = ['beginner', 'occasional', 'regular'];

/** Daily target, in minutes. */
export type DailyIntention = 5 | 10 | 15 | 20;

export const DAILY_INTENTIONS: DailyIntention[] = [5, 10, 15, 20];

export type ReminderPreference = {
  enabled: boolean;
  /** Local time, 24h. Scheduling itself is wired in L6. */
  hour: number;
  minute: number;
};

export type OnboardingState = {
  completed: boolean;
  goals: PracticeGoal[];
  experience: ExperienceLevel | null;
  dailyIntentionMin: DailyIntention | null;
  reminder: ReminderPreference;
};

export const INITIAL_ONBOARDING: OnboardingState = {
  completed: false,
  goals: [],
  experience: null,
  dailyIntentionMin: null,
  reminder: { enabled: false, hour: 21, minute: 30 },
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** A category slug doubles as a practice goal — the two vocabularies are one. */
export type CategorySlug = PracticeGoal;

export type SessionId = string;

/** Gradient pair painted as artwork, until real artwork exists. */
export type AccentPair = readonly [string, string];

export type Category = {
  slug: CategorySlug;
  accent: AccentPair;
};

export type MeditationSession = {
  id: SessionId;
  categorySlug: CategorySlug;
  durationSec: number;
  /** Three, always. A fourth stops being read. */
  benefitCount: 3;
  isPremium: boolean;
  accent: AccentPair;
};

/** Where a session was left, in seconds. */
export type SessionProgress = {
  positionSec: number;
  completedCount: number;
  lastPlayedISO: string;
};

/**
 * One completed practice — guided session or breathing exercise alike. This is
 * what L5 builds the streak and the statistics from, so a breathing exercise
 * counts exactly as much as a guided session.
 */
export type PracticeEntry = {
  /** Local calendar day, `YYYY-MM-DD`. The streak is counted in local days. */
  dateISO: string;
  sessionId?: SessionId;
  patternId?: string;
  seconds: number;
};

export type LibraryState = {
  favorites: SessionId[];
  progress: Record<SessionId, SessionProgress>;
  practiceLog: PracticeEntry[];
};

export const INITIAL_LIBRARY: LibraryState = { favorites: [], progress: {}, practiceLog: [] };

/** Keeps the log from growing without bound; a year is more than the UI shows. */
export const PRACTICE_LOG_MAX = 400;

/** Below this, a session is not worth offering to resume; above it, it is done. */
export const RESUME_MIN_RATIO = 0.05;
export const RESUME_MAX_RATIO = 0.95;
