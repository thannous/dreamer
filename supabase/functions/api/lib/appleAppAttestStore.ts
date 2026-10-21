import { createClient } from 'jsr:@supabase/supabase-js@2';

export type AppAttestChallenge = {
  id: string;
  challenge: string;
  key_id: string;
  fingerprint_hash: string;
  kind: 'attestation' | 'assertion';
  expires_at: string;
  consumed_at: null;
};

export type AppAttestKey = {
  key_id: string;
  fingerprint_hash: string;
  public_key_pem: string;
  environment: 'development' | 'production';
  app_id: string;
  assertion_counter: number;
};

export type AppAttestStore = {
  issue(fingerprint: string, keyId: string): Promise<AppAttestChallenge | null>;
  challenge(token: string): Promise<AppAttestChallenge | null>;
  key(keyId: string): Promise<AppAttestKey | null>;
  completeAttestation(input: {
    challengeId: string;
    keyId: string;
    fingerprint: string;
    publicKeyPem: string;
    receiptBase64: string;
    environment: 'development' | 'production';
    appId: string;
  }): Promise<boolean>;
  completeAssertion(input: {
    challengeId: string;
    keyId: string;
    fingerprint: string;
    counter: number;
  }): Promise<boolean>;
};

const KEYS = 'ios_guest_app_attest_keys';
const encoder = new TextEncoder();
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const DOMAIN = 'noctalia-ios-app-attest-challenge-v1:';

type ChallengePayload = Omit<AppAttestChallenge, 'id' | 'consumed_at'> & { v: 1 };

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 1024) throw new Error('Invalid challenge token');
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function challengeMacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('GUEST_SESSION_SECRET')?.trim();
  if (!secret) throw new Error('App Attest challenge signing unavailable');
  return crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signChallenge(payload: ChallengePayload): Promise<string> {
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await challengeMacKey(),
    encoder.encode(DOMAIN + payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function readChallenge(token: string): Promise<AppAttestChallenge | null> {
  if (token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const signature = base64UrlDecode(parts[1]);
    if (signature.length !== 32 || !await crypto.subtle.verify(
      'HMAC', await challengeMacKey(), new Uint8Array(signature), encoder.encode(DOMAIN + parts[0])
    )) return null;
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true })
      .decode(base64UrlDecode(parts[0]))) as ChallengePayload;
    if (payload.v !== 1 || typeof payload.challenge !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(payload.challenge) ||
        typeof payload.key_id !== 'string' ||
        !/^[A-Za-z0-9+/]{43}=$/.test(payload.key_id) ||
        typeof payload.fingerprint_hash !== 'string' ||
        !/^[0-9a-f]{64}$/.test(payload.fingerprint_hash) ||
        (payload.kind !== 'attestation' && payload.kind !== 'assertion') ||
        typeof payload.expires_at !== 'string') return null;
    const expiresAt = Date.parse(payload.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
        expiresAt > Date.now() + CHALLENGE_TTL_MS) return null;
    return { ...payload, id: token, consumed_at: null };
  } catch {
    return null;
  }
}

export async function challengeCompletion(
  token: string,
  kind: AppAttestChallenge['kind'],
  keyId: string,
  fingerprint: string,
): Promise<{ digest: string; expiresAt: string } | null> {
  const challenge = await readChallenge(token);
  if (!challenge || challenge.kind !== kind ||
      challenge.key_id !== keyId || challenge.fingerprint_hash !== fingerprint) return null;
  // Hash the nonce, not the signed envelope: renewing a token for the same
  // nonce must never make an already consumed challenge usable again.
  const bytes = new Uint8Array(await crypto.subtle.digest(
    'SHA-256', encoder.encode(challenge.challenge)));
  const digest = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return { digest, expiresAt: challenge.expires_at };
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !serviceRole) throw new Error('App Attest storage unavailable');
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAppAttestStore(): AppAttestStore {
  const client = adminClient();
  return {
    async issue(fingerprint, keyId) {
      const existing = await this.key(keyId);
      if (existing && existing.fingerprint_hash !== fingerprint) return null;
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const payload: ChallengePayload = {
        v: 1,
        challenge: base64UrlEncode(bytes),
        key_id: keyId,
        fingerprint_hash: fingerprint,
        kind: existing ? 'assertion' : 'attestation',
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      };
      const id = await signChallenge(payload);
      return { ...payload, id, consumed_at: null };
    },
    challenge: readChallenge,
    async key(keyId) {
      const { data, error } = await client.from(KEYS)
        .select('key_id,fingerprint_hash,public_key_pem,environment,app_id,assertion_counter')
        .eq('key_id', keyId).maybeSingle();
      if (error) throw new Error('App Attest key lookup unavailable');
      return data as AppAttestKey | null;
    },
    async completeAttestation(input) {
      const completion = await challengeCompletion(
        input.challengeId, 'attestation', input.keyId, input.fingerprint);
      if (!completion) return false;
      const { data, error } = await client.rpc('complete_ios_guest_app_attestation', {
        p_challenge_digest: completion.digest,
        p_challenge_expires_at: completion.expiresAt,
        p_key_id: input.keyId,
        p_fingerprint_hash: input.fingerprint,
        p_public_key_pem: input.publicKeyPem,
        p_receipt_base64: input.receiptBase64,
        p_environment: input.environment,
        p_app_id: input.appId,
      });
      return !error && data === true;
    },
    async completeAssertion(input) {
      const completion = await challengeCompletion(
        input.challengeId, 'assertion', input.keyId, input.fingerprint);
      if (!completion) return false;
      const { data, error } = await client.rpc('complete_ios_guest_app_assertion', {
        p_challenge_digest: completion.digest,
        p_challenge_expires_at: completion.expiresAt,
        p_key_id: input.keyId,
        p_fingerprint_hash: input.fingerprint,
        p_counter: input.counter,
      });
      return !error && data === true;
    },
  };
}
