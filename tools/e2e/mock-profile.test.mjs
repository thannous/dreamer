import test from 'node:test';
import assert from 'node:assert/strict';
import { getMockCategorizationDelayMs } from '../../lib/env.ts';
test('categorization QA delay activates only for the bounded opt-in persistent mock profile', () => {
  const keys = ['EXPO_PUBLIC_MOCK_MODE', 'EXPO_PUBLIC_MOCK_PERSISTENCE', 'EXPO_PUBLIC_MOCK_CATEGORIZATION_DELAY_MS'];
  const saved = keys.map(key => process.env[key]);
  try {
    for (const [mock, persistence, value, expected] of [
      ['false', 'true', '30000', undefined], ['true', 'false', '30000', undefined],
      ['true', 'true', '', undefined], ['true', 'true', '30000', 30000],
      ['true', 'true', '0', undefined], ['true', 'true', '19999', undefined],
      ['true', 'true', '60001', undefined], ['true', 'true', 'not-a-number', undefined],
    ]) {
      [process.env[keys[0]], process.env[keys[1]], process.env[keys[2]]] = [mock, persistence, value];
      assert.equal(getMockCategorizationDelayMs(), expected);
    }
  } finally { keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; }); }
});
