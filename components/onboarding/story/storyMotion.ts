/**
 * The onboarding's choreography, in one place.
 *
 * The onboarding is seen once per install, so it is the one screen that passes the
 * frequency gate for an authored entrance. It never gates input: every control is
 * live from the first frame, and the first act settles in about two seconds.
 *
 * The story is told on one vertical axis, top to bottom of the painting:
 *   I.   Arrival — the night opens its eyes (the sky settles from a slight zoom), the
 *        sentence arrives line by line, and when « une histoire » lands the moon
 *        answers with a halo. Raconter → Repérer → Relier then ignite as a
 *        constellation and a spark runs along the thread: the product loop itself.
 *   II.  Descent — choosing a first step tilts the camera down toward the lake; the
 *        choices rise from below. Going back reverses it.
 *   III. Plunge — committing pushes the camera into the scene while the copy
 *        recedes, so the handoff to capture reads as intentional.
 *
 * Milliseconds. Arrival values are offsets from the first frame.
 */
export const STORY = {
  skySettle: 2400,
  chrome: 200,
  titleLead: 300,
  titleAccent: 620,
  moonHalo: 760,
  subtitle: 900,
  /** First node; the next ones follow at `nodeStep`. */
  node: 1100,
  nodeStep: 360,
  thread: 420,
  spark: 1900,
  sparkTravel: 1100,
  privacy: 1800,
  cta: 1250,
  /** One soft ring around the CTA once the loop is complete. */
  ctaInvite: 2600,
  /** Once, while the user reads. Never repeats. */
  shootingStar: 3400,

  /** Entering duration on arrival. */
  arrive: 640,
  /** Entering duration on a step change. */
  enter: 480,
  /** Stagger between path choices. */
  stepStagger: 70,
  /** Returning to a step already seen replays its entrance at this speed. */
  returnScale: 0.3,
  /** Camera tilt between steps. On-screen movement, so ease-in-out. */
  camera: 1100,
  /** Camera push when the user commits. */
  plunge: 900,
  /** The next screen's ground fades in once the plunge is under way. */
  exitFadeDelay: 120,
  exitFade: 260,
} as const;

/** Vertical travel, in points. The next step waits below. */
export const TRAVEL = { arrive: 16, step: 22 } as const;

/** Under reduce motion a stagger is still motion; it collapses to a near-simultaneous fade. */
export const reducedDelay = (delay: number): number => Math.min(delay, 120);
