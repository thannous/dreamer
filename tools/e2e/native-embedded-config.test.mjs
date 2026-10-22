import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from './qualification.mjs';
import { verifyLocalBackendBinaryConfig } from './native-release.mjs';

const origin = 'http://127.0.0.1:31283', publicKey = 'synthetic-local-public-key';
const profile = { name: 'local-backend', backend: { origin, anonKeySha256: digest(publicKey) } };
const configuration = () => ({ extra: {
  supabaseUrl: origin, apiUrl: `${origin}/functions/v1/api`, supabaseAnonKey: publicKey, supabaseFunctionJwt: publicKey,
  nativeQaAudio: true, eas: { projectId: 'noctalia-qa-local' },
  revenuecatAndroidKey: '', revenuecatIosKey: '', revenuecatWebKey: '',
} });

// Reproduces the actual APK failure: a local receipt/env hid hosted app.config
// fallbacks. Unsafe binaries must be refused before any UI login or fixture use.
test('a truthful local receipt cannot qualify hosted or mismatched embedded APK config', () => {
  const inspect = (config, record) => verifyLocalBackendBinaryConfig({ binaryPath: '/owned/release.apk', platform: 'android', profile, record,
    read: (command, args) => { assert.equal(command, 'unzip'); assert.deepEqual(args, ['-p', '/owned/release.apk', 'assets/app.config']); return JSON.stringify(config); } });
  const proof = inspect(configuration());
  assert.equal(proof.publicKeyMatches, true);
  assert.equal(proof.storeKeysDisabled, true);
  assert.equal(JSON.stringify(proof).includes(publicKey), false);
  for (const mutate of [
    c => { c.extra.supabaseUrl = 'https://example.supabase.co'; }, c => { c.extra.apiUrl = 'https://example.invalid/api'; },
    c => { c.extra.supabaseAnonKey = 'different-public-key'; }, c => { c.extra.supabaseFunctionJwt = 'different-function-key'; },
    c => { c.extra.revenuecatAndroidKey = 'store-key'; }, c => { c.extra.revenuecatIosKey = 'store-key'; },
    c => { c.extra.revenuecatWebKey = 'store-key'; }, c => { delete c.extra.revenuecatIosKey; },
    c => { c.extra.nativeQaAudio = false; }, c => { c.extra.eas.projectId = 'other-project'; },
  ]) {
    const config = configuration(); mutate(config); let recorded;
    assert.throws(() => inspect(config, value => { recorded = value; }), /BINARY_CONFIG_MISMATCH/);
    assert.equal(recorded.configurationRead, true);
    assert.equal(JSON.stringify(recorded).includes(publicKey), false);
    assert.equal(JSON.stringify(recorded).includes('store-key'), false);
  }
});

test('iOS reads one actual EXConstants config and refuses missing or ambiguous resources', () => {
  const binaryPath = mkdtempSync(join(tmpdir(), 'noctalia-ios-config-'));
  const file = join(binaryPath, 'EXConstants.bundle', 'app.config');
  const dynamic = join(binaryPath, 'Frameworks', 'EXConstants.framework', 'EXConstants.bundle', 'app.config');
  const inspect = () => verifyLocalBackendBinaryConfig({ binaryPath, platform: 'ios', profile });
  try {
    assert.throws(inspect, /CONFIG_UNREADABLE/);
    mkdirSync(join(binaryPath, 'EXConstants.bundle')); writeFileSync(file, JSON.stringify(configuration()));
    assert.equal(inspect().publicKeyMatches, true);
    mkdirSync(join(binaryPath, 'Frameworks', 'EXConstants.framework', 'EXConstants.bundle'), { recursive: true });
    writeFileSync(dynamic, JSON.stringify(configuration()));
    assert.throws(inspect, /CONFIG_UNREADABLE/);
    rmSync(file);
    assert.equal(inspect().configPath, 'Frameworks/EXConstants.framework/EXConstants.bundle/app.config');
    writeFileSync(dynamic, '{"private":"do-not-echo"');
    assert.throws(inspect, error => error.message === 'LOCAL_BACKEND_BINARY_CONFIG_UNREADABLE');
  } finally { rmSync(binaryPath, { recursive: true, force: true }); }
});
