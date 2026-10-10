// Guard for the shared test-login tooling (doc_web_interne/docs/test-login.md).
// Every script that writes test accounts or logs them in against a hosted
// Supabase project must call runGuarded before any network call, use only
// the target.url and the accounts it hands over, and never read
// E2E_SUPABASE_URL itself. The policy is not configurable by callers: the
// production ref and key are pinned here and the allowlist is the committed
// file next to this script. It refuses, failing closed:
// - the production project, pinned below from PRODUCTION_CONSTANTS.md and
//   app.json (also refused when its ref or public key appears in any value);
// - any project whose ref is not in scripts/test-supabase-targets.json
//   (empty today: no test or staging project exists yet), and an allowlist
//   entry that is not a 20-character lowercase ref or is the production ref;
// - any URL that is not exactly https://<ref>.supabase.co (byte for byte,
//   one trailing slash allowed);
// - an E2E_SUPABASE_PROJECT_REF, or a legacy JWT key, naming another project;
// - any account email outside e2e+free@<domain> and e2e+premium@<domain>.
// There is no override. It never prints a key or a password.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

export const FORBIDDEN_PROJECT_REFS = Object.freeze(['usuyppgsmmowzizhaoqj']);
// The production publishable key, already public in app.json and .env.playstore.
export const FORBIDDEN_KEYS = Object.freeze(['sb_publishable_MpacCRXT8NJRcx6q_ww_pw_L_TQWi3n']);
// Next to this script, not the working directory.
export const TARGETS_FILE = path.join(SCRIPT_DIR, 'test-supabase-targets.json');
export const ENV_FILE = path.join(ROOT_DIR, '.env.test.local');
export const E2E_TIERS = Object.freeze(['free', 'premium']);
export const ENV_NAMES = Object.freeze([
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_PROJECT_REF',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_SUPABASE_SERVICE_ROLE_KEY',
  'E2E_ACCOUNT_DOMAIN',
  'E2E_FREE_PASSWORD',
  'E2E_PREMIUM_PASSWORD',
]);

const REF_PATTERN = /^[a-z0-9]{20}$/;
const HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;
const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export class TestTargetRefused extends Error {
  constructor(reason) {
    super(`test-login refused: ${reason}. Nothing was sent. There is no override; see doc_web_interne/docs/test-login.md.`);
    this.name = 'TestTargetRefused';
  }
}

function validateAllowedRefs(refs, source) {
  if (!Array.isArray(refs) || !refs.every((ref) => typeof ref === 'string')) {
    throw new TestTargetRefused(`${source} must hold an allowedProjectRefs array of strings`);
  }
  for (const ref of refs) {
    if (!REF_PATTERN.test(ref)) throw new TestTargetRefused(`${source} holds "${ref}", which is not a 20-character lowercase project ref`);
    if (FORBIDDEN_PROJECT_REFS.includes(ref)) throw new TestTargetRefused(`${source} allowlists the production Supabase project (${ref})`);
  }
  return refs;
}

// The committed allowlist; validated on every read.
export function loadAllowedRefs() {
  const parsed = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
  return validateAllowedRefs(parsed.allowedProjectRefs, path.basename(TARGETS_FILE));
}

function jwtRef(key) {
  const parts = String(key).split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

function checkTarget(env, allowedRefs) {
  const forbiddenRefs = FORBIDDEN_PROJECT_REFS;
  const forbiddenKeys = FORBIDDEN_KEYS;
  const values = ENV_NAMES.map((name) => String(env[name] ?? ''));
  for (const ref of forbiddenRefs) {
    if (values.some((value) => value.toLowerCase().includes(ref))) throw new TestTargetRefused(`the production Supabase project (${ref}) is named in the test env`);
  }
  for (const key of forbiddenKeys) {
    if (values.includes(key)) throw new TestTargetRefused('a production Supabase key is in the test env');
  }

  const raw = env.E2E_SUPABASE_URL;
  if (!raw) throw new TestTargetRefused('E2E_SUPABASE_URL is not set');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TestTargetRefused('E2E_SUPABASE_URL is not a URL');
  }
  const match = HOST_PATTERN.exec(url.hostname);
  if (url.protocol !== 'https:' || !match || url.port || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new TestTargetRefused('E2E_SUPABASE_URL must be exactly https://<project-ref>.supabase.co');
  }
  const ref = match[1];
  const canonical = `https://${ref}.supabase.co`;
  if (raw !== canonical && raw !== `${canonical}/`) {
    throw new TestTargetRefused('E2E_SUPABASE_URL must be exactly https://<project-ref>.supabase.co');
  }
  if (forbiddenRefs.includes(ref)) throw new TestTargetRefused(`${ref} is the production Supabase project`);
  if (env.E2E_SUPABASE_PROJECT_REF !== ref) throw new TestTargetRefused('E2E_SUPABASE_PROJECT_REF must be set and equal the ref in E2E_SUPABASE_URL');
  if (allowedRefs.length === 0) {
    throw new TestTargetRefused('no test Supabase project is allowlisted in scripts/test-supabase-targets.json');
  }
  if (!allowedRefs.includes(ref)) throw new TestTargetRefused(`${ref} is not an allowlisted test Supabase project`);
  for (const name of ['E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY']) {
    const keyRef = env[name] ? jwtRef(env[name]) : null;
    if (keyRef && keyRef !== ref) throw new TestTargetRefused(`${name} belongs to another Supabase project`);
  }
  return { ref, url: canonical };
}

// The runtime check: pinned production ref and key, committed allowlist.
// It takes only the env; nothing a caller passes can change the policy.
export function assertTestSupabaseTarget(env) {
  return checkTarget(env, loadAllowedRefs());
}

export function accountEmail(tier, domain) {
  if (!E2E_TIERS.includes(tier)) throw new TestTargetRefused(`unknown test account tier "${tier}"`);
  const normalized = String(domain ?? '').trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(normalized)) throw new TestTargetRefused('E2E_ACCOUNT_DOMAIN must be a plain domain name');
  return `e2e+${tier}@${normalized}`;
}

// Refuses any email that is not exactly one of the test accounts.
export function assertE2eAccountEmail(email, domain) {
  const allowed = E2E_TIERS.map((tier) => accountEmail(tier, domain));
  if (!allowed.includes(String(email))) throw new TestTargetRefused('only e2e+free@<domain> and e2e+premium@<domain> may be used');
  return email;
}

function guardedAccounts(env) {
  return E2E_TIERS.map((tier) => ({ tier, email: accountEmail(tier, env.E2E_ACCOUNT_DOMAIN) }));
}

async function guardedRun(env, action, allowedRefs, fetch) {
  const target = checkTarget(env, allowedRefs);
  const accounts = guardedAccounts(env);
  return action({ target, accounts, fetch });
}

// The only entry point for tooling that talks to the test project. The target
// and the account domain are checked first, synchronously, so a refusal
// happens before any network call. The action gets the canonical target URL
// and only the two test accounts (e2e+free@ and e2e+premium@ the domain);
// it must not use any other URL or address. Only fetch is injectable.
export async function runGuarded(env, action, { fetch = globalThis.fetch } = {}) {
  return guardedRun(env, action, loadAllowedRefs(), fetch);
}

// TEST ONLY: the same checks with an injected allowlist (validated like the
// committed one, so it can never hold the production ref). Never imported by
// runtime scripts; a static test enforces that.
export function _assertWithListsForTests(env, { allowedRefs = [] } = {}) {
  return checkTarget(env, validateAllowedRefs(allowedRefs, 'the test allowlist'));
}

// TEST ONLY: runGuarded with an injected allowlist (see above).
export async function _runGuardedWithListsForTests(env, action, { allowedRefs = [], fetch = globalThis.fetch } = {}) {
  return guardedRun(env, action, validateAllowedRefs(allowedRefs, 'the test allowlist'), fetch);
}

// .env.test.local (gitignored) overrides the process env for the E2E_* names only.
export function readTestEnv({ file = ENV_FILE, env = process.env } = {}) {
  const fromFile = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const merged = {};
  for (const name of ENV_NAMES) {
    const value = fromFile[name] ?? env[name];
    if (value !== undefined && value !== '') merged[name] = value;
  }
  return merged;
}

export function main({ log = console.log, env = readTestEnv() } = {}) {
  const target = assertTestSupabaseTarget(env);
  guardedAccounts(env);
  log(`[test-login] ${target.url} is an allowlisted test project. No request was made.`);
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
