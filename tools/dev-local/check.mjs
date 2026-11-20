#!/usr/bin/env node
/**
 * `node tools/dev-local/check.mjs`: proves a running dev-local backend through the
 * app's real HTTP interface. A web guest and an iOS Simulator guest get a session
 * and a capture question, a guest device is refused its third analysis until
 * « Nouvel invité » resets it;
 * the free and Plus accounts sign in, read their quota and get a question too.
 * It reads only the local manifest and never reaches production.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dataDir = resolve(process.env.DEV_LOCAL_DIR ?? join(root, 'outputs/dev-local'));
// The server's own validation: a native stack on loopback, a private plain-HTTP origin.
const { parseDevLocalManifest } = await import('./manifest.mts');
const manifest = parseDevLocalManifest(JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8')));
const { accounts } = JSON.parse(readFileSync(join(dataDir, 'secrets.json'), 'utf8'));
const origin = manifest.publicOrigin;
const anon = manifest.status.ANON_KEY;

const results = [];
async function step(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
    console.log(`ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL ${name} — ${error.message}`);
  }
}
async function call(path, { body, headers = {}, method = 'POST' } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method, headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  if (!response.ok) throw new Error(`${path} ${response.status} ${typeof value === 'object' ? JSON.stringify(value) : value}`.slice(0, 300));
  return value;
}
const dream = { transcript: 'Je marchais dans un jardin la nuit, une lampe restait allumée au bout de l’allée.', lang: 'fr', previousQuestions: [] };
const isQuestion = (value) => typeof value?.question === 'string' && value.question.trim().endsWith('?') && value.done === false;

const fingerprint = randomBytes(32).toString('hex');
let guestHeaders;
await step('web guest session (Turnstile test token)', async () => {
  const session = await call('/functions/v1/api/guest/session', {
    body: { fingerprint, platform: 'web', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
  });
  if (!session.token) throw new Error('no token');
  guestHeaders = { 'x-guest-token': session.token, 'x-guest-fingerprint': fingerprint, 'x-guest-platform': 'web' };
  return `expires ${session.expiresAt}`;
});
await step('guest capture question (capture-recall)', async () => {
  const answer = await call('/functions/v1/capture-recall/recall-question', { body: dream, headers: guestHeaders });
  if (!isQuestion(answer)) throw new Error(JSON.stringify(answer));
  return answer.question;
});
await step('guest capture formatting', async () => {
  const answer = await call('/functions/v1/capture-recall/format-recall', { body: dream, headers: guestHeaders });
  if (typeof answer.transcript !== 'string' || !answer.transcript) throw new Error(JSON.stringify(answer));
});
// The Simulator has no App Attest: a development build asks this backend for a session without a proof.
const simulatorFingerprint = randomBytes(32).toString('hex');
let simulatorHeaders;
await step('iOS Simulator guest session (no App Attest)', async () => {
  const session = await call('/functions/v1/api/guest/session', {
    body: { fingerprint: simulatorFingerprint, platform: 'ios', localSimulator: true },
  });
  if (!session.token) throw new Error('no token');
  simulatorHeaders = { 'x-guest-token': session.token, 'x-guest-fingerprint': simulatorFingerprint, 'x-guest-platform': 'ios' };
  return `expires ${session.expiresAt}`;
});
await step('Simulator guest capture question', async () => {
  const answer = await call('/functions/v1/capture-recall/recall-question', { body: dream, headers: simulatorHeaders });
  if (!isQuestion(answer)) throw new Error(JSON.stringify(answer));
});
await step('an iOS guest without App Attest or the Simulator field is refused', async () => {
  try {
    await call('/functions/v1/api/guest/session', { body: { fingerprint: simulatorFingerprint, platform: 'ios' } });
  } catch (error) {
    if (/ 40[01] /.test(error.message)) return 'refused as in production';
    throw error;
  }
  throw new Error('accepted without a proof');
});
await step('a guest without a session is refused', async () => {
  try {
    await call('/functions/v1/capture-recall/recall-question', { body: dream });
  } catch (error) {
    if (/ 40[13] /.test(error.message)) return 'refused as in production';
    throw error;
  }
  throw new Error('accepted without a guest session');
});

// « Nouvel invité »: a guest device that used its analyses starts again after the local reset.
const resetFingerprint = randomBytes(32).toString('hex');
let resetHeaders;
const analyze = (n) => call('/functions/v1/api/analyzeDream', {
  headers: resetHeaders,
  body: { transcript: `${dream.transcript} Nuit ${n} : la lampe changeait de couleur.`, lang: 'fr', analysisRequestId: crypto.randomUUID() },
});
const illustrate = (n) => call('/functions/v1/api/image-jobs', {
  headers: resetHeaders,
  body: { transcript: `${dream.transcript} Illustration ${n}.`, clientRequestId: crypto.randomUUID() },
});
await step('guest uses its 2 analyses, the third is refused', async () => {
  const session = await call('/functions/v1/api/guest/session', {
    body: { fingerprint: resetFingerprint, platform: 'web', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
  });
  resetHeaders = { 'x-guest-token': session.token, 'x-guest-fingerprint': resetFingerprint, 'x-guest-platform': 'web' };
  await analyze(1);
  await analyze(2);
  try {
    await analyze(3);
  } catch (error) {
    if (/ 4\d\d /.test(error.message)) return error.message.split(' ').slice(0, 2).join(' ');
    throw error;
  }
  throw new Error('a third guest analysis was accepted');
});
await step('guest uses its 2 illustrations, the third is refused', async () => {
  await illustrate(1);
  await illustrate(2);
  try {
    await illustrate(3);
  } catch (error) {
    if (/ 4\d\d /.test(error.message)) return error.message.split(' ').slice(0, 2).join(' ');
    throw error;
  }
  throw new Error('a third guest illustration was accepted');
});
await step('« Nouvel invité » resets that device, and it can analyse and illustrate again', async () => {
  const result = await call('/functions/v1/api/dev-local/guest-reset', { body: {}, headers: resetHeaders });
  if (result.reset !== true || !(result.forgotten?.guestUsage >= 1)) throw new Error(JSON.stringify(result));
  await analyze(4);
  // Image admission also counts the guest's recent jobs: the reset forgets them too.
  await illustrate(4);
  return JSON.stringify(result.forgotten);
});

for (const kind of ['free', 'plus']) {
  let headers;
  await step(`${kind} account signs in`, async () => {
    const session = await call('/auth/v1/token?grant_type=password', {
      body: { email: accounts[kind].email, password: accounts[kind].password },
    });
    headers = { Authorization: `Bearer ${session.access_token}` };
    return accounts[kind].email;
  });
  await step(`${kind} account quota`, async () => {
    const quota = await call('/functions/v1/api/quota/status', { body: {}, headers });
    const tier = quota.tier ?? quota.subscription?.tier ?? quota.plan;
    if (tier !== kind) throw new Error(`tier ${JSON.stringify(tier)} in ${JSON.stringify(quota).slice(0, 200)}`);
    return `tier ${tier}`;
  });
  await step(`${kind} account store sync keeps the stored entitlement`, async () => {
    const sync = await call('/functions/v1/api/subscription/refresh', { body: {}, headers });
    if (sync.tier !== kind || sync.changed !== false) throw new Error(JSON.stringify(sync));
  });
  await step(`${kind} account capture question`, async () => {
    const answer = await call('/functions/v1/api/recall-question', { body: dream, headers });
    if (!isQuestion(answer)) throw new Error(JSON.stringify(answer));
  });
}

await step('private dream-images bucket exists', async () => {
  const response = await fetch(`${manifest.status.API_URL.replace(/\/$/, '')}/storage/v1/bucket/dream-images`, {
    headers: { apikey: manifest.status.SERVICE_ROLE_KEY, Authorization: `Bearer ${manifest.status.SERVICE_ROLE_KEY}` },
  });
  const bucket = await response.json();
  if (!response.ok || bucket.public !== false) throw new Error(JSON.stringify(bucket).slice(0, 200));
});

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} local checks passed against ${origin}.`);
process.exit(failed ? 1 : 0);
