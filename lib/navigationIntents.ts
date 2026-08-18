const STAY_ON_SETTINGS_KEY = 'dreamer:return_to_settings';

export type AuthReturnDestination = '/(tabs)/settings' | '/lucid/(tabs)/settings';

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
  stayOnSettingsRequested = options?.destination ?? '/(tabs)/settings';
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
      : '/(tabs)/settings';
  }

  const destination = stayOnSettingsRequested;
  stayOnSettingsRequested = null;
  return destination;
}

/** Backward-compatible boolean API used by older tests and consumers. */
export function consumeStayOnSettingsIntent(): boolean {
  return consumeStayOnSettingsDestination() !== null;
}
