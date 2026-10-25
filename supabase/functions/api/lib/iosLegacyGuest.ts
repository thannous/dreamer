// Temporary bridge for Noctalia iOS builds released before 3.7.0.
//
// Those builds request a guest session with only { fingerprint, platform: 'ios' }
// and an analytics session with only { platform: 'ios' }, without App Attest.
// That is exactly what the api accepted before App Attest (v120). This bridge
// keeps accepting it for those builds only, until an end date, so the backend
// can roll out before every user has updated. It is never stronger than v120
// and never weaker: it only narrows who may still use the v120 flow.
//
// The old builds send no app version in the body or in a custom header. The
// only version signal they send is the default iOS networking User-Agent,
// `Noctalia/<CFBundleVersion> CFNetwork/<v> Darwin/<v>`, which carries the
// store build number. A caller can forge it, which gives nothing beyond what
// v120 already gives to anyone; the end date bounds that window.
//
// Fail closed everywhere: without a valid end date in the future, a valid
// highest legacy build number, and a User-Agent that parses to a build at or
// below it, the request is treated as 3.7.0 or later and must present App
// Attest.

/** ISO 8601 date with an explicit zone. After it, or when unset, legacy is off. */
export const IOS_LEGACY_GUEST_UNTIL_ENV = 'IOS_LEGACY_GUEST_UNTIL';
/** Highest iOS store build number released before 3.7.0. Unset means legacy is off. */
export const IOS_LEGACY_GUEST_MAX_BUILD_ENV = 'IOS_LEGACY_GUEST_MAX_BUILD';

// An end date further out than this is refused as a configuration error, so
// the bridge cannot be turned into a permanent bypass by a far-future value.
export const IOS_LEGACY_GUEST_MAX_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const BUILD_NUMBER = /^[1-9]\d{0,5}$/;
const LEGACY_USER_AGENT = /^Noctalia\/([1-9]\d{0,5}) CFNetwork\/[0-9][0-9.]{0,31} Darwin\/[0-9][0-9.]{0,31}$/;

// Reason codes for every legacy decision. Only these literal codes reach the
// log; anything else becomes 'unknown'. None carries a request value.
const IOS_LEGACY_GUEST_REASONS = [
  'legacy_accepted',
  'legacy_disabled',
  'legacy_config_invalid',
  'legacy_expired',
  'legacy_version_unknown',
  'legacy_version_too_new',
  'legacy_build_attested',
] as const;

export type IosLegacyGuestReason = typeof IOS_LEGACY_GUEST_REASONS[number];
const IOS_LEGACY_GUEST_REASON_SET: ReadonlySet<string> = new Set(IOS_LEGACY_GUEST_REASONS);

export function toLoggedIosLegacyReason(reason: unknown): IosLegacyGuestReason | 'unknown' {
  return typeof reason === 'string' && IOS_LEGACY_GUEST_REASON_SET.has(reason)
    ? reason as IosLegacyGuestReason
    : 'unknown';
}

export type IosLegacyRoute = 'guest_session' | 'analytics_session';
const LOGGED_ROUTES: ReadonlySet<string> = new Set(['guest_session', 'analytics_session']);

type ReadEnv = (name: string) => string | undefined;
const denoEnv: ReadEnv = (name) => Deno.env.get(name);

type WindowState =
  | { open: true; maxBuild: number }
  | { open: false; reason: 'legacy_disabled' | 'legacy_config_invalid' | 'legacy_expired' };

/** Whether the bridge is configured and its end date has not passed. */
export function readIosLegacyWindow(now: number, readEnv: ReadEnv = denoEnv): WindowState {
  const until = readEnv(IOS_LEGACY_GUEST_UNTIL_ENV)?.trim();
  const maxBuild = readEnv(IOS_LEGACY_GUEST_MAX_BUILD_ENV)?.trim();
  if (!until && !maxBuild) return { open: false, reason: 'legacy_disabled' };
  if (!until || !maxBuild || !ISO_WITH_ZONE.test(until) || !BUILD_NUMBER.test(maxBuild)) {
    return { open: false, reason: 'legacy_config_invalid' };
  }
  const end = Date.parse(until);
  if (!Number.isFinite(end)) return { open: false, reason: 'legacy_config_invalid' };
  if (end <= now) return { open: false, reason: 'legacy_expired' };
  if (end - now > IOS_LEGACY_GUEST_MAX_WINDOW_MS) return { open: false, reason: 'legacy_config_invalid' };
  return { open: true, maxBuild: Number(maxBuild) };
}

/** Store build number from the default iOS User-Agent of a Noctalia build, or null. */
export function parseLegacyIosBuild(userAgent: string | null): number | null {
  if (!userAgent || userAgent.length > 160) return null;
  const match = LEGACY_USER_AGENT.exec(userAgent.trim());
  return match ? Number(match[1]) : null;
}

export type IosLegacyDecision =
  | { accepted: true; reason: 'legacy_accepted'; build: number }
  | { accepted: false; reason: Exclude<IosLegacyGuestReason, 'legacy_accepted'> };

/**
 * Decide whether a request without App Attest proof may use the v120 iOS flow.
 * `attestedBuilds` are the bundle versions configured for App Attest: a build
 * listed there is a 3.7.0 or later build and never gets the legacy flow, even
 * if the highest legacy build number is misconfigured.
 */
export function decideIosLegacyGuest(input: {
  userAgent: string | null;
  now: number;
  attestedBuilds?: readonly string[];
  readEnv?: ReadEnv;
}): IosLegacyDecision {
  const window = readIosLegacyWindow(input.now, input.readEnv ?? denoEnv);
  if (!window.open) return { accepted: false, reason: window.reason };
  const build = parseLegacyIosBuild(input.userAgent);
  if (build === null) return { accepted: false, reason: 'legacy_version_unknown' };
  if (input.attestedBuilds?.includes(String(build))) {
    return { accepted: false, reason: 'legacy_build_attested' };
  }
  if (build > window.maxBuild) return { accepted: false, reason: 'legacy_version_too_new' };
  return { accepted: true, reason: 'legacy_accepted', build };
}

/** Logs a legacy decision: route, reason code and, when accepted, the build number. */
export function logIosLegacyDecision(route: IosLegacyRoute, decision: IosLegacyDecision): void {
  const entry = {
    route: LOGGED_ROUTES.has(route) ? route : 'unknown',
    reason: toLoggedIosLegacyReason(decision.reason),
    ...(decision.accepted ? { build: decision.build } : {}),
  };
  if (decision.accepted) console.log('[api] ios legacy guest', entry);
  else console.warn('[api] ios legacy guest rejected', entry);
}
