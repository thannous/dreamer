import { lstatSync, readdirSync, realpathSync, statfsSync } from 'node:fs';
import { join, sep } from 'node:path';

// Allocated-file growth is an estimate, not an APFS quota. Never infer ownership
// from a change in the host's free space: other campaigns share that filesystem.
function allocatedFiles(roots) {
  const files = new Map();
  const links = [];
  const visit = path => {
    let stat;
    try { stat = lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink()) { links.push(path); return; }
    if (stat.isDirectory()) {
      let names;
      try { names = readdirSync(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const name of names) visit(join(path, name));
    } else if (stat.isFile()) files.set(`${stat.dev}:${stat.ino}`, (stat.blocks ?? Math.ceil(stat.size / 512)) * 512);
  };
  for (const root of roots) visit(root);
  return { files, links };
}

export function createCampaignStorage({ paths, freePath, limitBytes, reservedBytes = 0, minimumFreeBytes = 50_000_000_000, disk = statfsSync }) {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0 || !Number.isSafeInteger(reservedBytes)
    || reservedBytes < 0 || reservedBytes >= limitBytes || minimumFreeBytes < 50_000_000_000) throw new Error('CAMPAIGN_STORAGE_OPTIONS');
  const roots = [...new Set(paths.map(path => realpathSync(path)))];
  if (roots.some((path, i) => roots.some((other, j) => i !== j && path.startsWith(other + sep)))) throw new Error('CAMPAIGN_STORAGE_OVERLAP');
  const baseline = allocatedFiles(roots);
  let peakBytes = reservedBytes;
  return {
    addPath(path, { chargeExisting = false } = {}) {
      const root = realpathSync(path);
      if (roots.includes(root) || roots.some(other => root.startsWith(other + sep))) return;
      if (roots.some(other => other.startsWith(root + sep))) throw new Error('CAMPAIGN_STORAGE_OVERLAP');
      roots.push(root);
      if (!chargeExisting) for (const [key, bytes] of allocatedFiles([root]).files) baseline.files.set(key, bytes);
    },
    sample() {
      const current = allocatedFiles(roots);
      let growthBytes = 0;
      for (const [key, bytes] of current.files) growthBytes += Math.max(0, bytes - (baseline.files.get(key) ?? 0));
      peakBytes = Math.max(peakBytes, growthBytes + reservedBytes);
      const fs = disk(freePath);
      const freeBytes = Number(fs.bavail) * Number(fs.bsize);
      return { measurement: 'allocated-file-growth-estimate', paths: roots, growthBytes, reservedBytes, peakBytes, limitBytes,
        freeBytes, minimumFreeBytes, headroomBytes: Math.min(250_000_000, Math.floor(limitBytes * 0.025)), skippedLinks: current.links,
        refusal: freeBytes < minimumFreeBytes ? 'DISK_RESERVE' : peakBytes >= limitBytes - Math.min(250_000_000, Math.floor(limitBytes * 0.025)) ? 'CAMPAIGN_BUDGET' : null };
    },
  };
}
