import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARTERS, assertLocalMock, mockEnv, runBugbash } from './bugbash-prerelease.mjs';
import { FORBIDDEN_PROJECT_REFS } from '../../scripts/test-supabase-guard.mjs';

test('the pre-release bash has one charter per named area and stays in mock mode', () => {
  assert.deepEqual(CHARTERS.map(charter => charter.slug), ['capture', 'sauvegarde', 'journal', 'paiement', 'connexion']);
  const env = mockEnv({ PATH: '/usr/bin', EXPO_PUBLIC_MOCK_MODE: 'false' });
  assert.equal(env.EXPO_PUBLIC_MOCK_MODE, 'true');
  assert.equal(env.EXPO_PUBLIC_MOCK_AUDIO, 'true');
  assert.equal(env.EXPO_PUBLIC_MOCK_PERSISTENCE, 'true');
  assert.equal(runBugbash({ exploreCharters: false, env, login: false }), 0);
});

test('a production Supabase ref is refused before any explore', () => {
  assert.throws(() => assertLocalMock({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
  assert.throws(() => mockEnv({ EXPO_PUBLIC_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co` }), /production Supabase project/);
});
