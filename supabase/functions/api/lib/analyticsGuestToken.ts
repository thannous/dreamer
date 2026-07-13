const encoder = new TextEncoder();
const TOKEN_TTL_MS = 15 * 60 * 1000;

type AnalyticsGuestTokenPayload = {
  v: 1;
  purpose: 'product_analytics';
  session_id: string;
  platform: 'android';
  iat: number;
  exp: number;
};

const base64UrlEncode = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const base64UrlDecode = (input: string): Uint8Array => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
};

const getSigningSecret = (): string => {
  const secret = Deno.env.get('GUEST_SESSION_SECRET')?.trim();
  if (!secret) throw new Error('Missing GUEST_SESSION_SECRET');
  // Domain separation prevents quota guest tokens from being accepted here.
  return `product-analytics:${secret}`;
};

const sign = async (data: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
};

export async function createAnalyticsGuestToken(): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const payload: AnalyticsGuestTokenPayload = {
    v: 1,
    purpose: 'product_analytics',
    session_id: crypto.randomUUID(),
    platform: 'android',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL_MS) / 1000),
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await sign(data);
  return {
    token: `${data}.${signature}`,
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
  };
}

export async function verifyAnalyticsGuestToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signature] = parts;
  const expected = await sign(`${headerB64}.${payloadB64}`);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    ) as Partial<AnalyticsGuestTokenPayload>;
    return (
      payload.v === 1 &&
      payload.purpose === 'product_analytics' &&
      payload.platform === 'android' &&
      typeof payload.session_id === 'string' &&
      typeof payload.exp === 'number' &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
