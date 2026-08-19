import { Platform } from 'react-native';

import { getExpoPublicEnvValue } from '@/lib/env';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('[Turnstile]');

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const CONTAINER_ID = 'noctalia-turnstile-container';
const TOKEN_TIMEOUT_MS = 30_000;

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  callback: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = typeof globalThis & {
  turnstile?: TurnstileApi;
  document?: Document;
};

let scriptPromise: Promise<TurnstileApi | null> | null = null;

/** Site key is public by design; the secret stays on the API side. */
export function getTurnstileSiteKey(): string | null {
  const key = getExpoPublicEnvValue('EXPO_PUBLIC_TURNSTILE_SITE_KEY')?.trim();
  return key ? key : null;
}

/** Web guest sessions are possible only when a Turnstile site key is configured. */
export function isWebGuestSessionAvailable(): boolean {
  return Platform.OS === 'web' && getTurnstileSiteKey() !== null;
}

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi | null>((resolve) => {
    const win = globalThis as TurnstileWindow;
    if (win.turnstile) {
      resolve(win.turnstile);
      return;
    }
    const doc = win.document;
    if (!doc) {
      resolve(null);
      return;
    }
    const script = doc.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(win.turnstile ?? null);
    script.onerror = () => {
      log.warn('Turnstile script failed to load');
      resolve(null);
    };
    doc.head.appendChild(script);
  });
  return scriptPromise;
}

function getContainer(): HTMLElement | null {
  const doc = (globalThis as TurnstileWindow).document;
  if (!doc) return null;
  let container = doc.getElementById(CONTAINER_ID);
  if (!container) {
    container = doc.createElement('div');
    container.id = CONTAINER_ID;
    // Bottom-right, out of the way; Turnstile only paints it when a human
    // interaction is actually required (appearance: interaction-only).
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = '2147483000';
    doc.body.appendChild(container);
  }
  return container;
}

/**
 * Obtains a one-shot Cloudflare Turnstile token for the web guest session
 * request. Resolves null when Turnstile is not configured, cannot load, or the
 * challenge fails — callers then keep the "guest analysis unavailable" state.
 */
export async function getTurnstileToken(action = 'guest_session'): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  const sitekey = getTurnstileSiteKey();
  if (!sitekey) return null;

  const turnstile = await loadTurnstile();
  const container = getContainer();
  if (!turnstile || !container) return null;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    let widgetId: string | null = null;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (widgetId) {
        try {
          turnstile.remove(widgetId);
        } catch {
          // Widget already gone.
        }
      }
      resolve(token);
    };
    const timer = setTimeout(() => {
      log.warn('Turnstile challenge timed out');
      finish(null);
    }, TOKEN_TIMEOUT_MS);

    try {
      widgetId = turnstile.render(container, {
        sitekey,
        action,
        appearance: 'interaction-only',
        callback: (token) => finish(token),
        'error-callback': (code) => {
          log.warn('Turnstile challenge failed', { code });
          finish(null);
        },
        'expired-callback': () => finish(null),
        'timeout-callback': () => finish(null),
      });
    } catch (error) {
      log.warn('Turnstile render failed', error);
      finish(null);
    }
  });
}

/** Test hook: forget the cached script promise. */
export function resetTurnstileForTesting(): void {
  scriptPromise = null;
}
