const STAY_ON_SETTINGS_KEY = 'dreamer:return_to_settings';

let stayOnSettingsRequested = false;

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
};

/**
 * Mark that the user expects to remain on the settings tab after the next
 * successful authentication event. When `persist` is true the intent survives
 * a full page reload (useful for OAuth flows on web).
 */
export function requestStayOnSettingsIntent(options?: StayIntentOptions) {
  stayOnSettingsRequested = true;
  if (options?.persist) {
    getSessionStorage()?.setItem(STAY_ON_SETTINGS_KEY, '1');
  }
}

/**
 * Clear any pending intent. Useful when an auth flow fails before completion.
 */
export function clearStayOnSettingsIntent() {
  stayOnSettingsRequested = false;
  getSessionStorage()?.removeItem(STAY_ON_SETTINGS_KEY);
}

/**
 * Returns true once when a stay-on-settings intent is pending. Subsequent calls
 * return false until `requestStayOnSettingsIntent` is invoked again.
 */
export function consumeStayOnSettingsIntent(): boolean {
  const storage = getSessionStorage();
  if (storage?.getItem(STAY_ON_SETTINGS_KEY)) {
    storage.removeItem(STAY_ON_SETTINGS_KEY);
    stayOnSettingsRequested = false;
    return true;
  }

  const shouldStay = stayOnSettingsRequested;
  stayOnSettingsRequested = false;
  return shouldStay;
}
