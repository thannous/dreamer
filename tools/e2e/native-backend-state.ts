import { readFileSync } from 'node:fs';
import { assertBackendTarget } from '../../scripts/lib/backend-e2e-local.cjs';

export type NativeBackendAccount = { id: string; email: string; password: string };
export type NativeBackendState = {
  schemaVersion: 1; kind: 'noctalia-native-backend'; id: string;
  status: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; DB_URL: string;
    LOCAL_E2E_STACK: { id: string; runtime: 'native' } };
  proxy: { origin: string; controlToken: string; functionsOrigin?: string };
  accounts: { owner: NativeBackendAccount; other: NativeBackendAccount };
  profilePath: string; cliVersion: string; migrationFixtures: unknown;
};

export function readNativeBackendState(): NativeBackendState {
  const file = process.env.E2E_NATIVE_BACKEND_MANIFEST;
  if (!file) throw new Error('E2E_NATIVE_BACKEND_MANIFEST must identify this run\'s owned local stack.');
  const state = JSON.parse(readFileSync(file, 'utf8')) as NativeBackendState;
  if (state.schemaVersion !== 1 || state.kind !== 'noctalia-native-backend'
    || !/^[a-f0-9-]{36}$/.test(state.id)) throw new Error('Invalid native backend manifest.');
  assertBackendTarget(state.status);
  const origin = new URL(state.proxy.origin);
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || typeof state.proxy.controlToken !== 'string' || state.proxy.controlToken.length < 32)
    throw new Error('Native backend control must remain on the owned loopback proxy.');
  for (const account of Object.values(state.accounts)) {
    if (!/^[a-f0-9-]{36}$/.test(account.id) || !/^native-e2e-[a-z]+-[a-f0-9-]+@example\.test$/.test(account.email)
      || typeof account.password !== 'string' || account.password.length < 16)
      throw new Error('Native backend requires its disposable local accounts.');
  }
  if (state.accounts.owner.id === state.accounts.other.id) throw new Error('Account isolation needs distinct users.');
  return state;
}

export function nativeBackendCredentials() {
  const { accounts } = readNativeBackendState();
  return {
    nativeOwner: { username: accounts.owner.email, password: accounts.owner.password },
    nativeOther: { username: accounts.other.email, password: accounts.other.password },
  };
}
