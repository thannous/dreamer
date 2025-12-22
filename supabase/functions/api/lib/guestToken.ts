const encoder = new TextEncoder();

type GuestTokenPayload = {
  v: number;
  fingerprint: string;
  platform: string;
  iat: number;
  exp: number;
};

type GuestTokenVerification = {
  ok: boolean;
  reason?: string;
  payload?: GuestTokenPayload;
};

const TOKEN_TTL_MS = 15 * 60 * 1000;

const base64UrlEncode = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (input: string): Uint8Array => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const getGuestSessionSecret = (): string => {
  const secret = Deno.env.get('GUEST_SESSION_SECRET')?.trim();
  if (!secret) {
    throw new Error('Missing GUEST_SESSION_SECRET');
  }
  return secret;
};

const importHmacKey = async (secret: string): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
};

const sign = async (data: string, secret: string): Promise<string> => {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
};

export const createGuestToken = async (fingerprint: string, platform: string) => {
  const now = Date.now();
  const payload: GuestTokenPayload = {
    v: 1,
    fingerprint,
    platform,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL_MS) / 1000),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await sign(data, getGuestSessionSecret());

  return {
    token: `${data}.${signature}`,
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
  };
};

export const verifyGuestToken = async (
  token: string | null,
  fingerprint: string,
  platform?: string
): Promise<GuestTokenVerification> => {
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid_format' };
  }

  const [headerB64, payloadB64, signature] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = await sign(data, getGuestSessionSecret());

  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: GuestTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as GuestTokenPayload;
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }

  if (payload.v !== 1) {
    return { ok: false, reason: 'version_mismatch' };
  }

  if (payload.fingerprint !== fingerprint) {
    return { ok: false, reason: 'fingerprint_mismatch' };
  }

  if (platform && payload.platform !== platform) {
    return { ok: false, reason: 'platform_mismatch' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
};
