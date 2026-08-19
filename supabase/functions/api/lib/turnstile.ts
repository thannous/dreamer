/**
 * Cloudflare Turnstile server-side verification for web guest sessions.
 *
 * Fail closed: when `TURNSTILE_SECRET_KEY` is not configured, web guests are
 * refused (the client then keeps its "guest analysis unavailable" state and
 * invites account creation). The secret never leaves this module.
 */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 8_000;

export type TurnstileVerdict = { ok: boolean; reason?: string };

export type TurnstileVerifyInput = {
  token: string;
  remoteIp?: string | null;
  /** Expected `action` passed by the widget (defence in depth). */
  expectedAction?: string;
};

type TurnstileDependencies = {
  fetchImpl?: typeof fetch;
  readEnv?: (name: string) => string | undefined;
};

export function isTurnstileConfigured(readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)): boolean {
  return Boolean(readEnv('TURNSTILE_SECRET_KEY')?.trim());
}

export async function verifyTurnstileToken(
  input: TurnstileVerifyInput,
  dependencies: TurnstileDependencies = {}
): Promise<TurnstileVerdict> {
  const readEnv = dependencies.readEnv ?? ((name: string) => Deno.env.get(name));
  const secret = readEnv('TURNSTILE_SECRET_KEY')?.trim();
  if (!secret) return { ok: false, reason: 'not_configured' };

  const token = input.token?.trim();
  if (!token || token.length > 2048) return { ok: false, reason: 'missing_token' };

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (input.remoteIp) form.set('remoteip', input.remoteIp);

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: `siteverify_http_${response.status}` };
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; action?: string; 'error-codes'?: string[] }
      | null;
    if (!payload?.success) {
      const codes = Array.isArray(payload?.['error-codes']) ? payload['error-codes'].join(',') : 'unknown';
      return { ok: false, reason: `rejected:${codes}` };
    }
    if (input.expectedAction && payload.action && payload.action !== input.expectedAction) {
      return { ok: false, reason: 'action_mismatch' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort client IP from Supabase/Cloudflare edge headers. */
export function getRemoteIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('cf-connecting-ip') ?? headers.get('x-real-ip') ?? null;
}
