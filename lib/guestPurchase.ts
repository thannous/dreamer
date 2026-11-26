import { isLucidTrainer } from '@/lib/appVariant';
import { isMockModeEnabled } from '@/lib/env';
import { fetchJSON } from '@/lib/http';

/**
 * Buying Noctalia Plus without registering (App Review 5.1.1(v)).
 *
 * A guest pays on the store's anonymous customer. Once the store confirms, the app makes a
 * silent account (`lib/silentAccount.ts`) and signing it in moves the purchase onto it; the
 * server then grants Plus exactly as it does for any account. Lucid keeps its own flow.
 */
export const isGuestPurchaseEnabled = !isLucidTrainer;

export type GuestPurchaseKind = 'purchase' | 'restore';

// A store-confirmed purchase whose account is not made, or not confirmed by the server, yet.
const ATTEMPT_KEY = 'noctalia.guest_purchase.attempt';
const ATTEMPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type GuestPurchaseAttempt = {
  kind: GuestPurchaseKind;
  customerId: string;
  activeBefore: boolean;
  startedAt: number;
};

const PENDING_KEY = 'noctalia.guest_purchase.pending';
// Plus sits on this device's silent account: the next account signed in here takes it over.
const HANDOVER_KEY = 'noctalia.silent_plus.handover';

// Loaded on first use: the subscription provider imports this module at startup, and neither
// native storage nor the Supabase client should be created for a screen that never needs them.
type Storage = typeof import('@react-native-async-storage/async-storage').default;
const getStorage = (): Storage =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@react-native-async-storage/async-storage') as { default: Storage }).default;
const getPublicConfiguration = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/lib/supabase') as typeof import('@/lib/supabase')).getSupabasePublicConfiguration();

const SETTINGS_TIMEOUT_MS = 8000;

/** Re-read the server setting before a guest store operation. */
export async function isSilentAccountAvailable(): Promise<boolean> {
  if (isMockModeEnabled()) return true;
  const config = getPublicConfiguration();
  if (!config) return false;
  try {
    const settings = await fetchJSON<{ external?: { anonymous_users?: unknown } }>(
      config.projectUrl + '/auth/v1/settings',
      { headers: { apikey: config.publicKey }, timeoutMs: SETTINGS_TIMEOUT_MS },
    );
    return settings?.external?.anonymous_users === true;
  } catch {
    return false;
  }
}

export async function readGuestPurchaseAttempt(): Promise<GuestPurchaseAttempt | null> {
  try {
    const value = await getStorage().getItem(ATTEMPT_KEY);
    const attempt = value ? JSON.parse(value) as Partial<GuestPurchaseAttempt> : null;
    if (!attempt || (attempt.kind !== 'purchase' && attempt.kind !== 'restore') ||
        typeof attempt.customerId !== 'string' || typeof attempt.activeBefore !== 'boolean' ||
        typeof attempt.startedAt !== 'number' || Date.now() - attempt.startedAt > ATTEMPT_MAX_AGE_MS) return null;
    return attempt as GuestPurchaseAttempt;
  } catch {
    return null;
  }
}

export async function saveGuestPurchaseAttempt(attempt: GuestPurchaseAttempt): Promise<void> {
  // A store operation must not start if we cannot save the record used to recover it.
  await getStorage().setItem(ATTEMPT_KEY, JSON.stringify(attempt));
}

export async function clearGuestPurchaseAttempt(): Promise<void> {
  await getStorage().removeItem(ATTEMPT_KEY).catch(() => {});
}

export async function readGuestPurchasePending(): Promise<GuestPurchaseKind | null> {
  try {
    const value = await getStorage().getItem(PENDING_KEY);
    return value === 'purchase' || value === 'restore' ? value : null;
  } catch {
    return null;
  }
}

export async function markGuestPurchasePending(kind: GuestPurchaseKind): Promise<void> {
  try {
    await getStorage().setItem(PENDING_KEY, kind);
  } catch {
    // The store keeps the purchase; Restore purchases finds it again.
  }
}

export async function clearGuestPurchasePending(): Promise<void> {
  try {
    await getStorage().multiRemove([PENDING_KEY, ATTEMPT_KEY]);
  } catch {
    // Read again, and cleared again, on the next confirmed status.
  }
}

export type SilentPlusHandover = { sourceUserId: string | null; receipts: string[]; targetUserId?: string };

export async function readSilentPlusHandover(): Promise<SilentPlusHandover | null> {
  try {
    const value = await getStorage().getItem(HANDOVER_KEY);
    if (value === '1') return { sourceUserId: null, receipts: [] };
    const handover = value ? JSON.parse(value) as Partial<SilentPlusHandover> : null;
    if (!handover || (handover.sourceUserId !== null && typeof handover.sourceUserId !== 'string') ||
        !Array.isArray(handover.receipts) || !handover.receipts.every(key => typeof key === 'string') ||
        (handover.targetUserId !== undefined && typeof handover.targetUserId !== 'string')) return null;
    return handover as SilentPlusHandover;
  } catch {
    return null;
  }
}

export async function setSilentPlusHandover(handover: SilentPlusHandover | null): Promise<void> {
  if (handover) await getStorage().setItem(HANDOVER_KEY, JSON.stringify(handover));
  else await getStorage().removeItem(HANDOVER_KEY);
}

// Signing the silent account in rebuilds the paywall (and navigation may bring a fresh one):
// the outcome of the purchase that caused it stays readable for a short while, so whichever
// screen ends up in front announces it. It is reported to analytics once.
const PAYWALL_OUTCOME_TTL_MS = 60_000;
let paywallOutcome: { kind: GuestPurchaseKind; until: number; reported: boolean } | null = null;

export function handGuestPurchaseOutcomeToPaywall(kind: GuestPurchaseKind, now = Date.now()): void {
  paywallOutcome = { kind, until: now + PAYWALL_OUTCOME_TTL_MS, reported: false };
}

export function peekGuestPurchaseOutcome(now = Date.now()): GuestPurchaseKind | null {
  if (paywallOutcome && now >= paywallOutcome.until) paywallOutcome = null;
  return paywallOutcome?.kind ?? null;
}

/** True for the first screen that announces the outcome: the one that reports it. */
export function claimGuestPurchaseOutcomeReport(): boolean {
  if (!paywallOutcome || paywallOutcome.reported) return false;
  paywallOutcome.reported = true;
  return true;
}

/** The purchase got no account after all: nothing to announce. */
export function takeGuestPurchaseOutcome(): GuestPurchaseKind | null {
  const outcome = paywallOutcome?.kind ?? null;
  paywallOutcome = null;
  return outcome;
}

// A silent account continues a guest's session in place: it must not meet the introduction
// again. The carry is short-lived and used once, by the next account's onboarding state.
const GUEST_ONBOARDING_CARRY_MS = 60_000;
let guestOnboardingCarryUntil = 0;

/** Call just before making the silent account for the guest in front of the screen. */
export function carryGuestOnboardingToNextAccount(now = Date.now()): void {
  guestOnboardingCarryUntil = now + GUEST_ONBOARDING_CARRY_MS;
}

export function takeGuestOnboardingCarry(now = Date.now()): boolean {
  const carried = now < guestOnboardingCarryUntil;
  guestOnboardingCarryUntil = 0;
  return carried;
}
