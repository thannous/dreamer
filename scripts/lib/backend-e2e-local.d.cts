export type BackendStatus = {
  API_URL: string;
  DB_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  LOCAL_E2E_STACK: { id: string; runtime: 'native' };
};
export function assertBackendTarget(status: BackendStatus): URL;
export function normalizeStackStatus(payload: unknown): BackendStatus;
export function prepareLocalMigrations(source: string, target: string): {
  neutralizedUrls: number;
  disabledSchedules: number;
};
