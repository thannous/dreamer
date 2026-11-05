/**
 * The local port a web target serves on. The mock products ask e2e for a free
 * one (port 0): the runner picks it when the config loads, hands it to the app
 * command through `{port}` and reports the served origin as `baseOrigin`, so
 * worktrees and parallel runs never fight over one port. The backend and branch
 * targets keep their fixed port: the backend proxy's CORS answer and the saved
 * branch sessions name that origin. E2E_WEB_PORT pins a port.
 */
import { BRANCH_WEB_PORT } from '../../scripts/test-auth-setup.mjs';

export const FIXED_WEB_PORTS = Object.freeze({ backend: 8085, branch: BRANCH_WEB_PORT });

/**
 * @param {string} product
 * @param {Record<string, string | undefined>} env
 * @returns {number} 0 asks for a free port
 */
export function webPort(product, env) {
  const fixed = FIXED_WEB_PORTS[product];
  const raw = env.E2E_WEB_PORT ?? String(fixed ?? 0);
  if (!/^\d{1,5}$/.test(raw) || Number(raw) > 65535) throw new Error('E2E_WEB_PORT must be a TCP port, or 0 for a free one.');
  if (fixed !== undefined && Number(raw) !== fixed) throw new Error('Backend and saved branch sessions require their fixed local origin.');
  return Number(raw);
}

/**
 * Whether a report's served origin is the one the run declared: the same origin,
 * or for a free-port declaration the loopback address the command bound, on the
 * port the run was given.
 * @param {string} declared
 * @param {unknown} served
 */
export function sameServedOrigin(declared, served) {
  if (declared !== 'http://127.0.0.1:0') return declared === served;
  const assigned = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(typeof served === 'string' ? served : '');
  return assigned !== null && Number(assigned[1]) <= 65535;
}
