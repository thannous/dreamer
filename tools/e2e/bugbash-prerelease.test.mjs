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
  schemaVersion: 'report-1', run: { explore: { findings, ended, steps } },
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
  for (const [exit, evidence] of [[0, undefined], [2, report()], [0, report([], 'step-limit')], [0, report([], 'finished', [{ status: 'failed' }])]]) {
    assert.equal(campaignExit([charterResult(CHARTERS[0], exit, evidence, '/report.json')]), 2);
  }
  assert.equal(campaignExit([], false), 2);
  assert.throws(() => runBugbash({ exploreCharters: false, only: 'typo' }), /Unknown/);
});

test('a production Supabase ref is refused before any explore', () => {
  assert.throws(() => assertLocalMock({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
  assert.throws(() => mockEnv({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
});
