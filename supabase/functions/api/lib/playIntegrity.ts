const encoder = new TextEncoder();

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type IntegrityPayload = {
  requestDetails?: {
    requestPackageName?: string;
    nonce?: string;
    requestHash?: string;
  };
  appIntegrity?: {
    appRecognitionVerdict?: string;
  };
  deviceIntegrity?: {
    deviceRecognitionVerdict?: string[];
  };
};

const base64UrlEncode = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecodeJson = <T>(token: string): T => {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=');
  const raw = atob(padded);
  return JSON.parse(raw) as T;
};

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
};

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
};

const signJwt = async (payload: Record<string, unknown>, serviceAccount: ServiceAccount): Promise<string> => {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${data}.${signatureB64}`;
};

const getServiceAccount = (): ServiceAccount => {
  const encoded = Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64')?.trim();
  if (!encoded) {
    throw new Error('Missing PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64');
  }
  const json = atob(encoded);
  const parsed = JSON.parse(json) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid service account JSON');
  }
  return parsed;
};

const getAccessToken = async (): Promise<string> => {
  const serviceAccount = getServiceAccount();
  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);

  const jwt = await signJwt(
    {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/playintegrity',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    },
    serviceAccount
  );

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Play Integrity auth failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Play Integrity auth missing access_token');
  }
  return data.access_token;
};

const decodeIntegrityToken = async (packageName: string, integrityToken: string): Promise<IntegrityPayload> => {
  const accessToken = await getAccessToken();
  const url = `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrityToken }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Play Integrity decode failed: ${response.status} ${text}`);
  }

  const data = (await response.json().catch(() => null)) as { tokenPayloadExternal?: unknown } | null;
  if (!data?.tokenPayloadExternal) {
    throw new Error('Play Integrity decode missing tokenPayloadExternal');
  }

  const tokenPayloadExternal = data.tokenPayloadExternal;
  if (typeof tokenPayloadExternal === 'object' && tokenPayloadExternal !== null) {
    return tokenPayloadExternal as IntegrityPayload;
  }

  if (typeof tokenPayloadExternal === 'string') {
    const trimmed = tokenPayloadExternal.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed) as IntegrityPayload;
      } catch {
        // Fall through to JWT decoding attempt.
      }
    }

    const parts = trimmed.split('.');
    if (parts.length >= 2) {
      return base64UrlDecodeJson<IntegrityPayload>(parts[1]);
    }
  }

  throw new Error('Play Integrity payload invalid');
};

const verdictAllows = (verdicts?: string[]): boolean => {
  if (!verdicts || verdicts.length === 0) return false;
  return verdicts.includes('MEETS_STRONG_INTEGRITY') || verdicts.includes('MEETS_DEVICE_INTEGRITY');
};

export const verifyAndroidIntegrity = async (options: {
  integrityToken: string;
  requestHash: string;
}): Promise<{ ok: boolean; reason?: string }> => {
  const packageName = Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME')?.trim();
  if (!packageName) {
    throw new Error('Missing PLAY_INTEGRITY_PACKAGE_NAME');
  }

  let payload: IntegrityPayload;
  try {
    payload = await decodeIntegrityToken(packageName, options.integrityToken);
  } catch (error) {
    console.error('[api] Play Integrity decode error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, reason: 'decode_error' };
  }
  const requestDetails = payload.requestDetails;
  const requestPackageName = requestDetails?.requestPackageName;
  const nonce = requestDetails?.nonce ?? requestDetails?.requestHash ?? null;

  if (requestPackageName !== packageName) {
    return { ok: false, reason: 'package_mismatch' };
  }
  if (!nonce || nonce !== options.requestHash) {
    return { ok: false, reason: 'nonce_mismatch' };
  }

  const appVerdict = payload.appIntegrity?.appRecognitionVerdict;
  if (appVerdict !== 'PLAY_RECOGNIZED') {
    return { ok: false, reason: 'app_unrecognized' };
  }

  if (!verdictAllows(payload.deviceIntegrity?.deviceRecognitionVerdict)) {
    return { ok: false, reason: 'device_not_integrity' };
  }

  return { ok: true };
};
