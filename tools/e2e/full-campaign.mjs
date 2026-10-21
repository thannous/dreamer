import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sourceSnapshot, compareSnapshots, verifyEvidenceFiles } from './qualification.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** One entry point, retaining each guarded run's report and exact rerun environment. */
export async function runFullCampaign() {
  const id = `full-${Date.now()}-${randomUUID()}`;
  const output = join(root, 'tools/e2e/.e2e/full', id);
  mkdirSync(output, { recursive: true });
  const env = { ...process.env, E2E_CAMPAIGN_ID: id, E2E_PERSONAS: '0', E2E_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
  delete env.E2E_WEB_PORT;
  delete env.E2E_BACKEND_STATUS_FILE;
  delete env.E2E_BACKEND_PROFILE;
  const steps = [];
  let interrupted;
  async function execute(name, args, overrides = {}, qualified = true) {
    console.log(`[TesterArmy full] ${name}`);
    const log = createWriteStream(join(output, `${name}.log`), { flags: 'wx' });
    const child = spawn(process.execPath, args, { cwd: root, env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log.write(chunk); text += chunk; });
    const signal = name => { interrupted = name; child.kill(name); };
    const interrupt = () => signal('SIGINT');
    const terminate = () => signal('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGTERM' ? 143 : 130)));
      });
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      await new Promise(resolve => log.end(resolve));
    }
    const evidence = [...text.matchAll(/^E2E evidence: (.+)$/gm)].map(match => match[1].trim());
    const row = { name, command: ['node', ...args], environment: overrides, exitCode: code, evidence };
    try {
      if (qualified) {
        if (evidence.length !== 1) throw new Error('Exactly one child evidence directory is required.');
        const path = evidence[0];
        verifyEvidenceFiles(path);
        const end = JSON.parse(readFileSync(join(path, 'end.json'), 'utf8'));
        if (end.exitCode !== 0 || !end.stability?.sourceStable || !end.stability?.outputsStable) throw new Error('Child qualification refused.');
        const proof = JSON.parse(readFileSync(join(path, name === 'dreamer-union' ? 'campaign.json' : 'qualification.json'), 'utf8'));
        if (!Array.isArray(proof.passed) || !proof.passed.length) throw new Error('Child did not pass.');
        row.result = { passed: proof.passed.length, skipped: proof.skipped?.length ?? 0, revision: proof.revision };
      }
    } catch (error) { row.error = error.message; row.exitCode ||= 1; }
    steps.push(row);
    console.log(`[TesterArmy full] ${name}: ${row.exitCode === 0 ? 'PASS' : 'FAIL'} — ${evidence[0] ?? join(output, `${name}.log`)}`);
    return row.exitCode === 0;
  }
  let before;
  try {
    // Refuse missing subscription authentication; there is no API-key fallback.
    if (!await execute('chatgpt-login', ['tools/e2e/node_modules/e2e/dist/cli/bin.js', 'models', 'openai'], {}, false))
      throw new Error('ChatGPT login unavailable. Run npm run test:testerarmy:login first.');
    if (!await execute('site-build', ['--run', 'docs:build'], {}, false)) throw new Error('Generated site build failed.');
    before = sourceSnapshot(root, 'dreamer');
    for (const [locale, featureSheets] of [['en-US', true], ['fr-FR', true], ['de-DE', true], ['en-US', false]]) {
      if (interrupted) break;
      await execute(`dreamer-${locale}-${featureSheets ? 'sheets' : 'direct'}`, ['tools/e2e/run.mjs', 'dreamer', 'web', 'run'], {
        E2E_WEB_LOCALE: locale, EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: String(featureSheets),
      });
    }
    if (!interrupted) await execute('dreamer-union', ['tools/e2e/run.mjs', 'dreamer', 'web', 'collect'], { E2E_WEB_LOCALE: 'en-US' });
    for (const product of ['lucid', 'meditation', 'site']) {
      if (interrupted) break;
      await execute(product, ['tools/e2e/run.mjs', product, 'web', 'run'], { E2E_WEB_LOCALE: product === 'lucid' ? 'fr-FR' : 'en-US' });
    }
    if (!interrupted) await execute('dreamer-chatgpt-pro', ['tools/e2e/run.mjs', 'dreamer', 'web', 'run', '--tag', 'personas'], {
      E2E_CAMPAIGN_ID: `${id}-pro`, E2E_PERSONAS: '1', E2E_WORKERS: '1', E2E_WEB_LOCALE: 'fr-FR',
      E2E_PERSONA_MODEL: env.E2E_PERSONA_MODEL?.trim() || 'gpt-6.1-sol', EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'false',
    });
    if (!interrupted) await execute('backend', ['scripts/run-backend-e2e.cjs']);
  } catch (error) { steps.push({ name: 'campaign-error', exitCode: 1, error: error.message }); }
  let after;
  try { after = sourceSnapshot(root, 'dreamer'); }
  catch (error) { steps.push({ name: 'source-error', exitCode: 1, error: error.message }); }
  const stable = before && after && compareSnapshots(before, after).sourceStable;
  const passed = !interrupted && stable && steps.length === 12 && steps.every(row => row.exitCode === 0);
  const report = { schemaVersion: 1, id, revision: after?.revision ?? before?.revision ?? null, source: after ?? null, passed: Boolean(passed),
    sourceStable: Boolean(stable), interrupted: interrupted ?? null, steps,
    rerun: 'mise exec -- npm run test:testerarmy:all',
    unqualified: ['Native Release/device runs require their identified build and owned target.',
      'Persistent Supabase branch remains opt-in and guarded by its target allowlist.',
      'Mock UI journeys do not prove real AI, Store transactions or production deployment.'] };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`Full TesterArmy evidence: ${output}/report.json`);
  return passed ? 0 : interrupted === 'SIGTERM' ? 143 : interrupted ? 130 : 1;
}
