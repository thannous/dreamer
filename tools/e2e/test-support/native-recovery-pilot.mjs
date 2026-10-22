// Bounded real-API preflight for the provider/transport fixture, before a native
// build. This is deliberately not reported as an iOS/Android journey pass.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertBackendTarget } from '../../../scripts/lib/backend-e2e-local.cjs';

const manifestPath = process.env.E2E_NATIVE_BACKEND_MANIFEST;
if (!manifestPath) throw new Error('Identify this invocation\'s local stack with E2E_NATIVE_BACKEND_MANIFEST.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.kind !== 'noctalia-native-backend' || manifest.schemaVersion !== 1) throw new Error('Invalid local native manifest.');
const backend = assertBackendTarget(manifest.status);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const recoveryOrigin = new URL(manifest.proxy.functionsOrigin);
if (recoveryOrigin.protocol !== 'http:' || recoveryOrigin.hostname !== '127.0.0.1' || !recoveryOrigin.port
  || recoveryOrigin.username || recoveryOrigin.password || recoveryOrigin.pathname !== '/' || recoveryOrigin.search || recoveryOrigin.hash)
  throw new Error('The recovery preflight requires the owned loopback API.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const owner = createClient(backend.origin, manifest.status.ANON_KEY, options);
const admin = createClient(backend.origin, manifest.status.SERVICE_ROLE_KEY, options);
const authentication = await owner.auth.signInWithPassword(manifest.accounts.owner);
assert.equal(authentication.error, null);
assert.equal(authentication.data.user.id, manifest.accounts.owner.id);

async function control(command) {
  const response = await fetch(new URL(command ? '/__control' : '/__state', recoveryOrigin), {
    method: command ? 'POST' : 'GET', headers: { 'X-E2E-Control-Token': manifest.proxy.controlToken, 'Content-Type': 'application/json' },
    ...(command ? { body: JSON.stringify(command) } : {}),
  });
  assert.equal(response.status, 200, 'Recovery control must succeed');
  return response.json();
}
const api = (path, body) => fetch(new URL(`/functions/v1/api${path}`, recoveryOrigin), {
  method: 'POST', headers: { Authorization: `Bearer ${authentication.data.session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
async function waitFor(read) {
  const started = Date.now();
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() - started > 30_000) throw new Error('Local API state did not converge within 30s');
    await new Promise(resolvePoll => setTimeout(resolvePoll, 100));
  }
}
const analysisRequestId = randomUUID();
let dreamId;
try {
  await control({ reset: true, analysisHold: true });
  const inserted = await owner.from('dreams').insert({
    user_id: manifest.accounts.owner.id, title: 'API recovery pilot',
    transcript: 'I walked to a lighthouse. Its door was blue and I could hear the sea.',
    interpretation: '', shareable_quote: '', dream_type: 'Everyday Dream', theme: 'calm',
    client_request_id: randomUUID(), analysis_status: 'pending', analysis_request_id: analysisRequestId, is_analyzed: false,
  }).select('id').single();
  assert.equal(inserted.error, null);
  dreamId = inserted.data.id;
  const quota = async () => {
    const result = await owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
    assert.equal(result.error, null); return result.data;
  };
  const before = await quota();
  const admitted = await api('/analysis-jobs', { dreamId, analysisRequestId, lang: 'en', replaceExistingImage: false });
  const job = await admitted.json();
  assert.equal(admitted.status, 202, JSON.stringify(job));
  await waitFor(async () => (await control()).analysisDispatches > 0);
  const pending = await admin.from('ai_jobs').select('status,quota_claimed').eq('id', job.jobId).single();
  assert.equal(pending.error, null);
  assert.deepEqual(pending.data, { status: 'queued', quota_claimed: true });
  await control({ analysisHold: false });
  await waitFor(async () => {
    const response = await api('/analysis-jobs/status', { jobId: job.jobId });
    const status = await response.json();
    assert.notEqual(status.status, 'failed', JSON.stringify(status));
    return status.status === 'succeeded';
  });
  const completed = await owner.from('dreams').select('interpretation,is_analyzed').eq('id', dreamId).single();
  assert.equal(completed.error, null);
  assert.equal(completed.data.is_analyzed, true);
  assert.match(completed.data.interpretation, /lighthouse can be a point of orientation/);
  const after = await quota();
  assert.equal(after.usage.analysis.used, before.usage.analysis.used + 1);
  const duplicate = await api('/analysis-jobs', { dreamId, analysisRequestId, lang: 'en', replaceExistingImage: false });
  const duplicateJob = await duplicate.json();
  assert.equal(duplicate.status, 202, JSON.stringify(duplicateJob));
  assert.equal(duplicateJob.jobId, job.jobId);
  assert.equal(duplicateJob.duplicate, true);

  await control({ chatDropDone: true });
  const body = { dreamId: String(dreamId), clientRequestId: randomUUID(), message: 'The blue door stayed in my memory.', lang: 'en', stream: true };
  const stream = await api('/chat', body);
  const lost = await stream.text();
  assert.equal(stream.status, 200, lost);
  assert.doesNotMatch(lost, /"done":true/);
  const saved = await owner.from('dreams').select('chat_history').eq('id', dreamId).single();
  assert.equal(saved.error, null);
  assert.equal(saved.data.chat_history.length, 2);
  const retry = await api('/chat', body);
  const recovered = await retry.text();
  assert.equal(retry.status, 200, recovered);
  assert.match(recovered, /"done":true/);
  const retained = await owner.from('dreams').select('chat_history').eq('id', dreamId).single();
  assert.equal(retained.error, null);
  assert.deepEqual(retained.data.chat_history, saved.data.chat_history);
  const finalQuota = await quota();
  assert.equal(finalQuota.usage.analysis.used, after.usage.analysis.used);
  assert.equal(finalQuota.usage.messages.used, 1);
  const state = await control();
  assert.equal(state.analysisProviderCalls, 1);
  assert.equal(state.chatProviderCalls, 1);
  assert.equal(state.droppedChatCompletions, 1);
  assert.equal(state.blockedExternalRequests, 0);
  assert.equal(new Set(state.analysisRequests).size, 1);
  assert.equal(new Set(state.chatRequests).size, 1);
  const receipt = {
    result: 'PASS', testedAt: new Date().toISOString(), boundary: 'API pilot only; no native UI/device qualification',
    source: {
      baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
      inputs: Object.fromEntries([
        'tools/e2e/test-support/native-recovery-api.ts',
        'tools/e2e/test-support/native-recovery-pilot.mjs',
        'supabase/functions/analysis-job-worker/index.ts',
        'supabase/functions/api/routes/analysisJobs.ts',
        'supabase/functions/api/routes/chat.ts',
      ].map(path => [path, createHash('sha256').update(readFileSync(resolve(repository, path))).digest('hex')])),
    },
    assertions: ['real queued admission', 'real worker completion', 'one analysis claim on duplicate admission',
      'chat completion acknowledgement dropped after real atomic commit', 'same request returns cached reply and one message quota'],
    providerCalls: { analysis: state.analysisProviderCalls, chat: state.chatProviderCalls }, blockedExternalRequests: state.blockedExternalRequests,
  };
  const output = resolve(process.env.E2E_NATIVE_RECOVERY_PILOT_OUTPUT ?? 'tools/e2e/.e2e/native-recovery-pilot.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ ...receipt, output }));
} finally {
  await control({ analysisHold: false });
  await waitFor(async () => (await control()).pendingWorkers === 0);
  if (dreamId !== undefined) {
    // Only this pilot's dream and its credits in the identified disposable
    // database are removed; no quota limit or enforcement rule is changed.
    for (const table of ['quota_usage', 'ai_jobs']) {
      const removed = await admin.from(table).delete().eq('user_id', manifest.accounts.owner.id).eq('dream_id', dreamId);
      assert.equal(removed.error, null);
    }
    const removed = await owner.from('dreams').delete().eq('id', dreamId);
    assert.equal(removed.error, null);
  }
  await owner.auth.signOut({ scope: 'local' });
}
