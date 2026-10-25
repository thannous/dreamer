import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  decideIosLegacyGuest,
  IOS_LEGACY_GUEST_MAX_BUILD_ENV,
  IOS_LEGACY_GUEST_UNTIL_ENV,
  logIosLegacyDecision,
  parseLegacyIosBuild,
  readIosLegacyWindow,
  toLoggedIosLegacyReason,
} from './iosLegacyGuest.ts';

const NOW = Date.parse('2026-10-25T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const UA_14 = 'Noctalia/14 CFNetwork/3896.100.1.2.1 Darwin/27.0.0';

const env = (values: Record<string, string | undefined>) => (name: string) => values[name];
const openEnv = (maxBuild = '14', until = new Date(NOW + 30 * DAY).toISOString()) =>
  env({ [IOS_LEGACY_GUEST_UNTIL_ENV]: until, [IOS_LEGACY_GUEST_MAX_BUILD_ENV]: maxBuild });

Deno.test('legacy window is closed unless both flags are valid and the end date is ahead', () => {
  assertEquals(readIosLegacyWindow(NOW, env({})), { open: false, reason: 'legacy_disabled' });
  assertEquals(readIosLegacyWindow(NOW, env({ [IOS_LEGACY_GUEST_UNTIL_ENV]: '2026-11-01T00:00:00Z' })),
    { open: false, reason: 'legacy_config_invalid' });
  assertEquals(readIosLegacyWindow(NOW, env({ [IOS_LEGACY_GUEST_MAX_BUILD_ENV]: '14' })),
    { open: false, reason: 'legacy_config_invalid' });
  for (const until of ['2026-11-01', '2026-11-01T00:00:00', 'tomorrow', '2026-13-40T00:00:00Z']) {
    assertEquals(readIosLegacyWindow(NOW, openEnv('14', until)), { open: false, reason: 'legacy_config_invalid' }, until);
  }
  for (const maxBuild of ['0', '-1', '14.1', 'abc', '1234567']) {
    assertEquals(readIosLegacyWindow(NOW, openEnv(maxBuild)), { open: false, reason: 'legacy_config_invalid' }, maxBuild);
  }
  assertEquals(readIosLegacyWindow(NOW, openEnv('14', '2026-10-25T08:00:00Z')), { open: false, reason: 'legacy_expired' });
  assertEquals(readIosLegacyWindow(NOW, openEnv('14', '2026-10-01T00:00:00+02:00')), { open: false, reason: 'legacy_expired' });
  assertEquals(readIosLegacyWindow(NOW, openEnv('14', new Date(NOW + 121 * DAY).toISOString())),
    { open: false, reason: 'legacy_config_invalid' });
  assertEquals(readIosLegacyWindow(NOW, openEnv('14', '2026-12-31T23:59:59+01:00')), { open: true, maxBuild: 14 });
});

Deno.test('the build number is read only from the default User-Agent of a Noctalia build', () => {
  assertEquals(parseLegacyIosBuild(UA_14), 14);
  assertEquals(parseLegacyIosBuild('Noctalia/9 CFNetwork/1568.200.51 Darwin/24.1.0'), 9);
  for (const userAgent of [
    null,
    '',
    'NoctaliaQA/14 CFNetwork/3896.100.1.2.1 Darwin/27.0.0',
    'Noctalia/14.1 CFNetwork/3896.100.1.2.1 Darwin/27.0.0',
    'Noctalia/014 CFNetwork/3896 Darwin/27.0.0',
    'Noctalia/14',
    'Mozilla/5.0 Noctalia/14 CFNetwork/3896 Darwin/27.0.0',
    'okhttp/4.12.0',
    'Noctalia/14 CFNetwork/3896 Darwin/27.0.0 extra',
  ]) {
    assertEquals(parseLegacyIosBuild(userAgent), null, String(userAgent));
  }
});

Deno.test('legacy decision accepts only a build at or below the highest legacy build', () => {
  assertEquals(decideIosLegacyGuest({ userAgent: UA_14, now: NOW, readEnv: openEnv('14') }),
    { accepted: true, reason: 'legacy_accepted', build: 14 });
  assertEquals(decideIosLegacyGuest({ userAgent: UA_14.replace('/14 ', '/15 '), now: NOW, readEnv: openEnv('14') }),
    { accepted: false, reason: 'legacy_version_too_new' });
  assertEquals(decideIosLegacyGuest({ userAgent: UA_14, now: NOW, readEnv: openEnv('20'), attestedBuilds: ['14'] }),
    { accepted: false, reason: 'legacy_build_attested' });
  assertEquals(decideIosLegacyGuest({ userAgent: null, now: NOW, readEnv: openEnv('14') }),
    { accepted: false, reason: 'legacy_version_unknown' });
  assertEquals(decideIosLegacyGuest({ userAgent: UA_14, now: NOW, readEnv: env({}) }),
    { accepted: false, reason: 'legacy_disabled' });
  assertEquals(decideIosLegacyGuest({ userAgent: UA_14, now: NOW + 31 * DAY, readEnv: openEnv('14') }),
    { accepted: false, reason: 'legacy_expired' });
});

Deno.test('legacy decisions log an allowlisted reason code and no request value', () => {
  const logged: unknown[][] = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args: unknown[]) => logged.push(args);
  console.warn = (...args: unknown[]) => logged.push(args);
  try {
    logIosLegacyDecision('guest_session', { accepted: true, reason: 'legacy_accepted', build: 14 });
    logIosLegacyDecision('analytics_session', { accepted: false, reason: 'legacy_version_unknown' });
    logIosLegacyDecision('guest_session', { accepted: false, reason: 'leak:secret' as 'legacy_disabled' });
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  assertEquals(logged, [
    ['[api] ios legacy guest', { route: 'guest_session', reason: 'legacy_accepted', build: 14 }],
    ['[api] ios legacy guest rejected', { route: 'analytics_session', reason: 'legacy_version_unknown' }],
    ['[api] ios legacy guest rejected', { route: 'guest_session', reason: 'unknown' }],
  ]);
  assertEquals(toLoggedIosLegacyReason('legacy_expired'), 'legacy_expired');
  assertEquals(toLoggedIosLegacyReason(undefined), 'unknown');
});
