import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtempSync, mkdirSync, writeFileSync, rmSync, linkSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCampaignStorage } from './campaign-storage.mjs';

test('external writes and deletions do not spend or refund a campaign budget; disk pressure stays global', () => {
  const root = mkdtempSync(join(tmpdir(), 'campaign-storage-'));
  try {
    const owned = join(root, 'owned'), external = join(root, 'external');
    mkdirSync(owned); mkdirSync(external);
    let free = 100_000_000_000;
    const budget = createCampaignStorage({ paths: [owned], freePath: root, limitBytes: 1_000_000,
      reservedBytes: 100_000, disk: () => ({ bavail: free, bsize: 1 }) });
    writeFileSync(join(external, 'other-run'), Buffer.alloc(100_000)); free -= 10_000_000_000;
    assert.equal(budget.sample().peakBytes, 100_000);
    rmSync(join(external, 'other-run')); free += 10_000_000_000;
    assert.equal(budget.sample().peakBytes, 100_000);
    writeFileSync(join(owned, 'trace'), Buffer.alloc(20_000));
    const own = budget.sample(); assert.ok(own.growthBytes > 0); assert.equal(own.refusal, null);
    // A deletion outside the campaign cannot hide growth inside it.
    free += 10_000_000_000; assert.equal(budget.sample().peakBytes, own.peakBytes);
    free = 49_000_000_000; assert.equal(budget.sample().refusal, 'DISK_RESERVE');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('existing caches form the baseline, new artifacts hit the cap, and hard links are counted once', () => {
  const root = mkdtempSync(join(tmpdir(), 'campaign-storage-'));
  try {
    writeFileSync(join(root, 'existing'), Buffer.alloc(100_000));
    const budget = createCampaignStorage({ paths: [root], freePath: root, limitBytes: 20_000, disk: () => ({ bavail: 100_000_000_000, bsize: 1 }) });
    assert.equal(budget.sample().peakBytes, 0);
    writeFileSync(join(root, 'new'), Buffer.alloc(32_000));
    const first = budget.sample(); assert.equal(first.refusal, 'CAMPAIGN_BUDGET');
    linkSync(join(root, 'new'), join(root, 'alias')); assert.equal(budget.sample().peakBytes, first.peakBytes);
    rmSync(join(root, 'new')); rmSync(join(root, 'alias')); assert.equal(budget.sample().peakBytes, first.peakBytes);
    assert.throws(() => createCampaignStorage({ paths: [root], freePath: root, limitBytes: 1, minimumFreeBytes: 1 }), /OPTIONS/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('late-owned device and SDK paths are charged, while another SDK run stays outside the campaign', () => {
  const root = mkdtempSync(join(tmpdir(), 'campaign-storage-'));
  try {
    const report = join(root, 'report'), device = join(root, 'device'), ownRun = join(root, 'own'), otherRun = join(root, 'other');
    for (const dir of [report, device, ownRun, otherRun]) mkdirSync(dir);
    writeFileSync(join(device, 'runtime'), Buffer.alloc(16_000));
    const budget = createCampaignStorage({ paths: [report], freePath: root, limitBytes: 100_000, disk: () => ({ bavail: 100_000_000_000, bsize: 1 }) });
    budget.addPath(device, { chargeExisting: true });
    const deviceBytes = budget.sample().growthBytes; assert.ok(deviceBytes >= 16_000);
    writeFileSync(join(otherRun, 'big-other-run'), Buffer.alloc(200_000)); assert.equal(budget.sample().growthBytes, deviceBytes);
    writeFileSync(join(ownRun, 'trace'), Buffer.alloc(8_000)); budget.addPath(ownRun, { chargeExisting: true });
    assert.ok(budget.sample().growthBytes >= deviceBytes + 8_000);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a directory removed between stat and enumeration is ignored, but access errors still fail closed', t => {
  const root = fs.realpathSync(mkdtempSync(join(tmpdir(), 'campaign-storage-')));
  const vanished = join(root, 'vanished');
  const readdir = fs.readdirSync;
  let accessDenied = false, removed = false;
  const enumeration = t.mock.method(fs, 'readdirSync', (path, ...options) => {
    if (accessDenied) throw Object.assign(new Error('access denied'), { code: 'EACCES' });
    if (path === vanished) { removed = true; rmSync(vanished, { recursive: true }); }
    return readdir(path, ...options);
  });
  syncBuiltinESMExports();
  try {
    const budget = createCampaignStorage({ paths: [root], freePath: root, limitBytes: 100_000,
      disk: () => ({ bavail: 100_000_000_000, bsize: 1 }) });
    mkdirSync(vanished); writeFileSync(join(vanished, 'temporary'), Buffer.alloc(8_000));
    writeFileSync(join(root, 'kept'), Buffer.alloc(8_000));
    const sample = budget.sample();
    assert.equal(removed, true); assert.ok(sample.growthBytes >= 8_000); assert.equal(sample.refusal, null);
    accessDenied = true;
    assert.throws(() => budget.sample(), { code: 'EACCES' });
  } finally {
    enumeration.mock.restore(); syncBuiltinESMExports();
    rmSync(root, { recursive: true, force: true });
  }
});
