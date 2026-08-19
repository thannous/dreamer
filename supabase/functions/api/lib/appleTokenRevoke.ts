const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_AUD = 'https://appleid.apple.com';
const CLIENT_SECRET_TTL_SECONDS = 3600;

export type AppleAuthConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export type AppleRevokeInput = {
  refreshToken?: string | null;
};

export class AppleTokenRevokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleTokenRevokeError';
  }
}

const encoder = new TextEncoder();

const base64UrlEncode = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

export function readAppleAuthConfig(
  readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)
): AppleAuthConfig | null {
  const clientId = readEnv('APPLE_CLIENT_ID')?.trim();
  const teamId = readEnv('APPLE_TEAM_ID')?.trim();
  const keyId = readEnv('APPLE_KEY_ID')?.trim();
  const privateKey = readEnv('APPLE_PRIVATE_KEY')?.trim();
  if (!clientId || !teamId || !keyId || !privateKey) {
    return null;
  }
  return { clientId, teamId, keyId, privateKey };
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const b64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function createAppleClientSecret(config: AppleAuthConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUD,
    sub: config.clientId,
  };
  const data = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(data)
  );
  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function exchangeAppleAuthorizationCode(
  authorizationCode: string,
  config: AppleAuthConfig
): Promise<string> {
  const clientSecret = await createAppleClientSecret(config);
  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!response.ok) {
    throw new AppleTokenRevokeError(`Apple token exchange failed (${response.status})`);
  }
  const body = await response.json() as { refresh_token?: unknown };
  if (typeof body.refresh_token !== 'string' || !body.refresh_token) {
    throw new AppleTokenRevokeError('Apple token exchange returned no refresh token');
  }
  return body.refresh_token;
}

export async function revokeAppleTokens(input: AppleRevokeInput): Promise<void> {
  const config = readAppleAuthConfig();
  if (!config) {
    throw new AppleTokenRevokeError('Apple token revocation is not configured');
  }
  if (!input.refreshToken) {
    throw new AppleTokenRevokeError('Missing Apple refresh token');
  }

  const clientSecret = await createAppleClientSecret(config);
  const response = await fetch(APPLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token: input.refreshToken,
      token_type_hint: 'refresh_token',
    }).toString(),
  });
  if (!response.ok) {
    throw new AppleTokenRevokeError(`Apple token revoke failed (${response.status})`);
  }
}
