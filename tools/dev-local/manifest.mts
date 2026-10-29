import { assertBackendTarget } from '../../scripts/lib/backend-e2e-local.cjs';

/** What tools/dev-local/dev-local.mjs hands the local API server, written 0600 under outputs/. */
export type DevLocalManifest = {
  kind: 'noctalia-dev-local';
  schemaVersion: 1;
  /** The identified native stack, loopback only. */
  status: {
    API_URL: string; DB_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string;
    LOCAL_E2E_STACK: { id: string; runtime: 'native' };
  };
  /** The origin phones use: this machine's private LAN address and the server port. */
  publicOrigin: string;
  port: number;
  guestSessionSecret: string;
  iosAppAttest: { teamId: string; bundleIds: string[] };
};

const PRIVATE_HOST = /^(?:127\.0\.0\.1|localhost|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2})$/;

/**
 * Accepts only a manifest whose backend is an identified native stack on this
 * machine and whose public origin is a plain-HTTP private address. A hosted
 * Supabase URL, an HTTPS origin or a public address is refused, so the local
 * guest verifiers and the fixed AI answers can never front a real backend.
 */
export function parseDevLocalManifest(value: unknown): DevLocalManifest {
  const manifest = value as DevLocalManifest;
  if (!manifest || manifest.kind !== 'noctalia-dev-local' || manifest.schemaVersion !== 1) {
    throw new Error('Only a dev:local manifest is accepted');
  }
  assertBackendTarget(manifest.status);
  const origin = new URL(manifest.publicOrigin);
  if (origin.protocol !== 'http:' || !PRIVATE_HOST.test(origin.hostname) || origin.origin !== manifest.publicOrigin ||
      Number(origin.port) !== manifest.port) {
    throw new Error('The local API must be published on a private plain-HTTP address of this machine');
  }
  if (!Number.isInteger(manifest.port) || manifest.port < 1024 || manifest.port > 65535) {
    throw new Error('Invalid local API port');
  }
  if (typeof manifest.guestSessionSecret !== 'string' || manifest.guestSessionSecret.length < 32) {
    throw new Error('Missing local guest session secret');
  }
  const { teamId, bundleIds } = manifest.iosAppAttest ?? {};
  if (typeof teamId !== 'string' || !/^[A-Z0-9]{10}$/.test(teamId) || !Array.isArray(bundleIds) || !bundleIds.length) {
    throw new Error('Invalid App Attest identity');
  }
  return manifest;
}
