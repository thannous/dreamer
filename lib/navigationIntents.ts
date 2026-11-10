const STAY_ON_SETTINGS_KEY = 'dreamer:return_to_settings';

export type AuthReturnDestination = '/settings' | '/lucid/(tabs)/settings';

let stayOnSettingsRequested: AuthReturnDestination | null = null;

const getSessionStorage = (): Storage | null => {
  try {
    const globalObject = globalThis as typeof globalThis & { sessionStorage?: Storage };
    return typeof globalObject.sessionStorage !== 'undefined' ? globalObject.sessionStorage : null;
  } catch {
    return null;
  }
};

type StayIntentOptions = {
  persist?: boolean;
  destination?: AuthReturnDestination;
};

/**
 * Mark that the user expects to remain on the settings tab after the next
 * successful authentication event. When `persist` is true the intent survives
 * a full page reload (useful for OAuth flows on web).
 */
export function requestStayOnSettingsIntent(options?: StayIntentOptions) {
  stayOnSettingsRequested = options?.destination ?? '/settings';
  if (options?.persist) {
    getSessionStorage()?.setItem(STAY_ON_SETTINGS_KEY, stayOnSettingsRequested);
  }
}

/**
 * Clear any pending intent. Useful when an auth flow fails before completion.
 */
export function clearStayOnSettingsIntent() {
  stayOnSettingsRequested = null;
  getSessionStorage()?.removeItem(STAY_ON_SETTINGS_KEY);
}

/**
 * Returns true once when a stay-on-settings intent is pending. Subsequent calls
 * return false until `requestStayOnSettingsIntent` is invoked again.
 */
export function consumeStayOnSettingsDestination(): AuthReturnDestination | null {
  const storage = getSessionStorage();
  const persisted = storage?.getItem(STAY_ON_SETTINGS_KEY);
  if (persisted) {
    storage?.removeItem(STAY_ON_SETTINGS_KEY);
    stayOnSettingsRequested = null;
    return persisted === '/lucid/(tabs)/settings'
      ? '/lucid/(tabs)/settings'
      : '/settings';
  }

  const destination = stayOnSettingsRequested;
  stayOnSettingsRequested = null;
  return destination;
}

const RETURN_TO_PAYWALL_KEY = 'dreamer:return_to_paywall';
/** A sign-in that takes longer than this is no longer "coming from the paywall". */
export const RETURN_TO_PAYWALL_TTL_MS = 10 * 60 * 1000;

/** `restore`: the guest tapped Restore purchases, which runs once they are signed in. */
type ReturnToPaywallIntent = { trigger: string; createdAt: number; restore?: true };

let returnToPaywallIntent: ReturnToPaywallIntent | null = null;

const serializeIntent = (intent: ReturnToPaywallIntent): string => JSON.stringify(intent);
const parseIntent = (raw: string | null): ReturnToPaywallIntent | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReturnToPaywallIntent>;
    if (typeof parsed?.trigger === 'string' && typeof parsed?.createdAt === 'number') {
      return { trigger: parsed.trigger, createdAt: parsed.createdAt, ...(parsed.restore === true ? { restore: true } : {}) };
    }
  } catch {
    // Legacy or corrupt value: ignore it.
  }
  return null;
};

const readPendingIntent = (now: number): ReturnToPaywallIntent | null => {
  const persisted = parseIntent(getSessionStorage()?.getItem(RETURN_TO_PAYWALL_KEY) ?? null);
  const intent = persisted ?? returnToPaywallIntent;
  if (!intent) return null;
  if (now - intent.createdAt > RETURN_TO_PAYWALL_TTL_MS) {
    clearReturnToPaywallIntent();
    return null;
  }
  return intent;
};

/**
 * Mark that the user came from the paywall and should be sent back to it (with
 * the same contextual trigger) once authentication succeeds — instead of being
 * left on the Settings tab with two extra taps to reach the purchase again.
 * The intent expires after `RETURN_TO_PAYWALL_TTL_MS` and is cleared when the
 * paywall is closed, purchased or restored.
 */
export function requestReturnToPaywallIntent(
  trigger: string,
  options?: { persist?: boolean; now?: number; restore?: boolean }
) {
  const intent: ReturnToPaywallIntent = {
    trigger,
    createdAt: options?.now ?? Date.now(),
    ...(options?.restore ? { restore: true } : {}),
  };
  returnToPaywallIntent = intent;
  if (options?.persist) {
    getSessionStorage()?.setItem(RETURN_TO_PAYWALL_KEY, serializeIntent(intent));
  }
}

/** Reads the pending paywall trigger without consuming it (null when absent or expired). */
export function peekReturnToPaywallTrigger(now: number = Date.now()): string | null {
  return readPendingIntent(now)?.trigger ?? null;
}

/** Whether the pending paywall return also asked to restore purchases. */
export function peekReturnToPaywallRestore(now: number = Date.now()): boolean {
  return readPendingIntent(now)?.restore === true;
}

/** Drops the restore request and keeps the way back to the paywall, so it runs only once. */
export function clearReturnToPaywallRestore() {
  const intent = readPendingIntent(Date.now());
  if (!intent?.restore) return;
  const kept: ReturnToPaywallIntent = { trigger: intent.trigger, createdAt: intent.createdAt };
  returnToPaywallIntent = kept;
  const storage = getSessionStorage();
  if (storage?.getItem(RETURN_TO_PAYWALL_KEY)) storage.setItem(RETURN_TO_PAYWALL_KEY, serializeIntent(kept));
}

export function clearReturnToPaywallIntent() {
  returnToPaywallIntent = null;
  getSessionStorage()?.removeItem(RETURN_TO_PAYWALL_KEY);
}

/**
 * Returns the pending paywall trigger once, or null. Also clears any pending
 * stay-on-settings intent because the paywall wins over the settings tab.
 */
export function consumeReturnToPaywallTrigger(now: number = Date.now()): string | null {
  const trigger = readPendingIntent(now)?.trigger ?? null;
  clearReturnToPaywallIntent();
  if (trigger) {
    clearStayOnSettingsIntent();
  }
  return trigger;
}
