import type { CategorySlug, MeditationSession, SessionId } from '@/lib/types';

import { CATEGORY_BY_SLUG } from './categories';

/**
 * The catalogue is static and typed, bundled with the app — like the template
 * this is modelled on, there is no content backend. Titles, descriptions and
 * benefits are i18n keys (`session.<id>.title`), never literals.
 *
 * 24 sessions, 8 of them free. `dream-prep` is entirely premium: it is the
 * bridge to the Noctalia journal and the reason to subscribe to both.
 *
 * Audio is NOT here. Only four sessions ship inside the bundle; the rest stream
 * from the media bucket and are wired in L3 (see spec §8.3).
 */
export const SESSIONS: MeditationSession[] = [
  {
    id: 'sleep-descent',
    categorySlug: 'sleep',
    durationSec: 600,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['sleep'].accent,
  },
  {
    id: 'sleep-quick-fall',
    categorySlug: 'sleep',
    durationSec: 300,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['sleep'].accent,
  },
  {
    id: 'sleep-body-scan',
    categorySlug: 'sleep',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['sleep'].accent,
  },
  {
    id: 'sleep-night-return',
    categorySlug: 'sleep',
    durationSec: 900,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['sleep'].accent,
  },
  {
    id: 'stress-shoulders',
    categorySlug: 'stress',
    durationSec: 300,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['stress'].accent,
  },
  {
    id: 'stress-unclench',
    categorySlug: 'stress',
    durationSec: 600,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['stress'].accent,
  },
  {
    id: 'stress-day-close',
    categorySlug: 'stress',
    durationSec: 900,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['stress'].accent,
  },
  {
    id: 'stress-storm',
    categorySlug: 'stress',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['stress'].accent,
  },
  {
    id: 'focus-morning',
    categorySlug: 'focus',
    durationSec: 300,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['focus'].accent,
  },
  {
    id: 'focus-one-thing',
    categorySlug: 'focus',
    durationSec: 600,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['focus'].accent,
  },
  {
    id: 'focus-thread',
    categorySlug: 'focus',
    durationSec: 600,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['focus'].accent,
  },
  {
    id: 'focus-deep',
    categorySlug: 'focus',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['focus'].accent,
  },
  {
    id: 'anxiety-ground',
    categorySlug: 'anxiety',
    durationSec: 300,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['anxiety'].accent,
  },
  {
    id: 'anxiety-wave',
    categorySlug: 'anxiety',
    durationSec: 600,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['anxiety'].accent,
  },
  {
    id: 'anxiety-chest',
    categorySlug: 'anxiety',
    durationSec: 900,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['anxiety'].accent,
  },
  {
    id: 'anxiety-evening',
    categorySlug: 'anxiety',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['anxiety'].accent,
  },
  {
    id: 'gratitude-three',
    categorySlug: 'gratitude',
    durationSec: 300,
    benefitCount: 3,
    isPremium: false,
    accent: CATEGORY_BY_SLUG['gratitude'].accent,
  },
  {
    id: 'gratitude-people',
    categorySlug: 'gratitude',
    durationSec: 600,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['gratitude'].accent,
  },
  {
    id: 'gratitude-ordinary',
    categorySlug: 'gratitude',
    durationSec: 900,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['gratitude'].accent,
  },
  {
    id: 'gratitude-year',
    categorySlug: 'gratitude',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['gratitude'].accent,
  },
  {
    id: 'dream-threshold',
    categorySlug: 'dream-prep',
    durationSec: 600,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['dream-prep'].accent,
  },
  {
    id: 'dream-recall',
    categorySlug: 'dream-prep',
    durationSec: 300,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['dream-prep'].accent,
  },
  {
    id: 'dream-question',
    categorySlug: 'dream-prep',
    durationSec: 900,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['dream-prep'].accent,
  },
  {
    id: 'dream-lucid',
    categorySlug: 'dream-prep',
    durationSec: 1200,
    benefitCount: 3,
    isPremium: true,
    accent: CATEGORY_BY_SLUG['dream-prep'].accent,
  },
];

export const SESSION_BY_ID: Record<SessionId, MeditationSession> = SESSIONS.reduce(
  (acc, session) => ({ ...acc, [session.id]: session }),
  {} as Record<SessionId, MeditationSession>
);

export const sessionsInCategory = (slug: CategorySlug): MeditationSession[] =>
  SESSIONS.filter((session) => session.categorySlug === slug);

export const freeSessions = (): MeditationSession[] =>
  SESSIONS.filter((session) => !session.isPremium);

/** Sessions at or under a duration, shortest first — powers the quick rows. */
export const sessionsUpTo = (maxMinutes: number): MeditationSession[] =>
  SESSIONS.filter((session) => session.durationSec <= maxMinutes * 60).sort(
    (a, b) => a.durationSec - b.durationSec
  );
