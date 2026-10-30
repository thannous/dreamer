import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARTERS, assertLocalMock, mockEnv, runBugbash, charterResult, campaignExit } from './bugbash-prerelease.mjs';
import { FORBIDDEN_PROJECT_REFS } from '../../scripts/test-supabase-guard.mjs';

test('the pre-release bash has one charter per named area and stays in mock mode', () => {
  assert.deepEqual(CHARTERS.map(charter => charter.slug), ['capture', 'sauvegarde', 'journal', 'paiement', 'connexion', 'saisies-limites', 'reprise', 'reflexion']);
  assert.equal(CHARTERS.find(charter => charter.slug === 'saisies-limites').agent, 'fuzzer');
  assert.ok(CHARTERS.every(charter => ['guest', 'seeded', 'draft'].includes(charter.session)));
  const env = mockEnv({ PATH: '/usr/bin', EXPO_PUBLIC_MOCK_MODE: 'false' });
  assert.equal(env.EXPO_PUBLIC_MOCK_MODE, 'true');
  assert.equal(env.EXPO_PUBLIC_MOCK_AUDIO, 'true');
  assert.equal(env.EXPO_PUBLIC_MOCK_PERSISTENCE, 'true');
  assert.equal(runBugbash({ exploreCharters: false, env, login: false }), 0);
});

const report = (findings = [], ended = 'finished', steps = [{ status: 'passed' }]) => ({
  schemaVersion: 'report-1', run: {
    runner: { name: 'e2e', version: '0.22.0' },
    targets: [{ id: 'dreamer-web', platform: 'web', environment: 'test', baseOrigin: 'http://127.0.0.1:8096', engine: { name: 'web', version: '0.15.4' } }],
    results: [{ attempts: [{ steps: [{ model: { provider: 'chatgpt.responses', model: 'gpt-6.1-terra', calls: 1 } }] }] }],
    explore: { findings, ended, steps },
  },
});

test('observations require triage even when the SDK returns zero; code one cannot disappear', () => {
  const result = charterResult(CHARTERS[0], 0, report([{ id: 'f1', kind: 'warning', title: 'Needs inspection' }]), '/report.json');
  assert.equal(campaignExit([result]), 1);
  assert.equal(result.findings[0].status, 'unreviewed');
  assert.equal(result.findings[0].reproTest, null);
  assert.equal(campaignExit([charterResult(CHARTERS[0], 1, report(), '/report.json')]), 1);
  assert.equal(campaignExit([charterResult(CHARTERS[0], 0, report(), '/report.json')]), 0);
});

test('missing reports, failed steps, budget exhaustion and changing source remain incomplete', () => {
  for (const [exit, evidence] of [[0, undefined], [2, report()], [0, report([], 'step-limit')], [0, report([], 'finished', [])], [0, report([], 'finished', [{ status: 'failed' }])]]) {
    assert.equal(campaignExit([charterResult(CHARTERS[0], exit, evidence, '/report.json')]), 2);
  }
  assert.equal(campaignExit([], false), 2);
  assert.throws(() => runBugbash({ exploreCharters: false, only: 'typo' }), /Unknown/);
});

test('a clean charter requires the actual pinned SDK, local target and model', () => {
  for (const mutate of [
    run => { run.runner.version = '0.21.3'; },
    run => { run.targets[0].engine.version = '0.15.3'; },
    run => { run.targets[0].baseOrigin = 'https://example.com'; },
    run => { run.targets[0].id = 'wrong-target'; },
    run => { run.results[0].attempts[0].steps[0].model.model = 'other-model'; },
    run => { run.results = []; },
  ]) {
    const evidence = report();
    mutate(evidence.run);
    assert.equal(charterResult(CHARTERS[0], 0, evidence, '/report.json').state, 'incomplete');
  }
  const evidence = report();
  assert.equal(charterResult(CHARTERS[0], 0, evidence, '/report.json', 'http://127.0.0.1:4591').state, 'incomplete');
  evidence.run.targets[0].baseOrigin = 'http://127.0.0.1:4591';
  assert.equal(charterResult(CHARTERS[0], 0, evidence, '/report.json', 'http://127.0.0.1:4591').state, 'no-findings');
});

test('a production Supabase ref is refused before any explore', () => {
  assert.throws(() => assertLocalMock({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
  assert.throws(() => mockEnv({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
});
