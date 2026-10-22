#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { MANIFEST, STATIC, MIME, sha256, readMedia, inventory, localPath,
  parallel, download, hydrate, verifyLocal, assertRemoteReceipt } = require('./lib/site-media');
const ROOT = path.resolve(__dirname, '..');
const CACHE = '.cache/site-media';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

async function verifyRemote(root, { fetcher = fetch } = {}) {
  const media = readMedia(root);
  if (!media?.config.publicOrigin) throw new Error('Configure the actual public CDN origin before verification');
  let checked = 0;
  await parallel(media.manifest.files, async entry => {
    await download(media, entry, fetcher);
    if (++checked % 500 === 0) console.log(`[site-media] verified ${checked}/${media.manifest.files.length}`);
  });
  const receipt = { schema: 1, release: media.manifest.release, origin: media.config.publicOrigin,
    checked, bytes: media.manifest.files.reduce((sum, row) => sum + row[1], 0),
    method: 'full GET, MIME, length and SHA-256 for every object', checkedAt: new Date().toISOString() };
  writeJson(path.join(root, 'docs-src/config/site-media-verification.json'), receipt);
  return receipt;
}

async function upload(root) {
  const media = readMedia(root);
  if (!media || !/^[a-f0-9]{32}$/.test(media.config.accountId) || !/^[a-z0-9-]{3,63}$/.test(media.config.bucket)) {
    throw new Error('Configure the existing Cloudflare account and the dedicated bucket first');
  }
  verifyLocal(root);
  // Credentials belong in an ignored private file or the caller environment, never the manifest or logs.
  const credentials = process.env.NOCTALIA_MEDIA_CREDENTIALS
    ? JSON.parse(fs.readFileSync(process.env.NOCTALIA_MEDIA_CREDENTIALS, 'utf8'))
    : { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY };
  if (!credentials.accessKeyId || !credentials.secretAccessKey) throw new Error('A bucket-scoped R2 Object Read & Write key is required');
  const { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: 'auto', endpoint: `https://${media.config.accountId}.r2.cloudflarestorage.com`,
    credentials, maxAttempts: 3, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const progressFile = path.join(root, CACHE, `${media.manifest.release}-uploaded.json`);
  let uploaded = 0;
  const completed = new Set();
  try {
    await parallel(media.manifest.files, async entry => {
      const Key = `releases/${media.manifest.release}/${entry[0]}`;
      const base = { Bucket: media.config.bucket, Key };
      let exists = true;
      try { await client.send(new HeadObjectCommand(base)); }
      catch (error) { if (error.$metadata?.httpStatusCode === 404) exists = false; else throw error; }
      if (!exists) {
        // Recheck immediately before sending: local art may have changed during a large transfer.
        const bytes = fs.readFileSync(localPath(root, entry[0]));
        if (bytes.length !== entry[1] || sha256(bytes) !== entry[2]) throw new Error(`Local image changed during transfer: ${entry[0]}`);
        await client.send(new PutObjectCommand({ ...base, Body: bytes,
          ContentType: MIME[path.extname(entry[0])], CacheControl: 'public, max-age=31536000, immutable',
          Metadata: { sha256: entry[2] }, IfNoneMatch: '*' }));
        uploaded++;
      }
      // A successful PUT/HEAD is not proof of preservation. Read every object's real bytes back.
      const result = await client.send(new GetObjectCommand(base));
      const bytes = await result.Body.transformToByteArray();
      if (bytes.length !== entry[1] || sha256(bytes) !== entry[2]) throw new Error(`R2 bytes differ: ${entry[0]}`);
      completed.add(entry[0]);
      if (completed.size % 100 === 0) {
        writeJson(progressFile, { release: media.manifest.release, completed: [...completed], uploaded });
        console.log(`[site-media] R2 checked ${completed.size}/${media.manifest.files.length}`);
      }
    });
  } finally {
    client.destroy();
    writeJson(progressFile, { release: media.manifest.release, completed: [...completed], uploaded });
  }
  return { checked: completed.size, uploaded };
}

function detach(root) {
  const media = readMedia(root);
  if (!media || media.config.delivery !== 'cdn') throw new Error('Enable CDN delivery only after remote verification');
  assertRemoteReceipt(root, media);
  verifyLocal(root);
  // Keep the small shared assets imported by the native app available in a clean checkout.
  const bundled = new Set(media.config.bundledPaths || []);
  if (bundled.size) {
    const kept = spawnSync('git', ['ls-files', '--error-unmatch', '--', ...[...bundled].map(file => `${STATIC}/${file}`)], { cwd: root, stdio: 'pipe' });
    if (kept.status !== 0) throw new Error('Bundled native images must remain tracked before media detachment');
  }
  const detachable = media.manifest.files.filter(row => !bundled.has(row[0]));
  // Remove index entries only, leaving every local byte and the entire existing history intact.
  if (detachable.length) {
    const list = path.join(root, CACHE, 'detach-paths.txt');
    fs.mkdirSync(path.dirname(list), { recursive: true });
    fs.writeFileSync(list, detachable.map(row => `${STATIC}/${row[0]}`).join('\0') + '\0');
    const result = spawnSync('git', ['rm', '--cached', '--ignore-unmatch', '--quiet', `--pathspec-from-file=${list}`, '--pathspec-file-nul'],
      { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Git refused to detach the media; no force option is used');
  }
  const ignore = path.join(root, '.gitignore');
  const pattern = '/docs-src/static/img/';
  if (!fs.readFileSync(ignore, 'utf8').split(/\r?\n/).includes(pattern)) {
    fs.appendFileSync(ignore, `\n# Restored byte-for-byte from the versioned CDN media manifest\n${pattern}\n`);
  }
  verifyLocal(root);
  return { detached: detachable.length, localFilesPreserved: true };
}

async function main(args = process.argv.slice(2), root = ROOT) {
  const [command] = args;
  if (args.length !== 1) throw new Error('Pass exactly one media command; see --help');
  if (command === '--help') {
    console.log('site-media: inventory | status | hydrate | refresh | upload | verify | detach\n' +
      'refresh re-encodes from current inputs then inventories a new media release;\n' +
      'inventory records every img file; upload copies to the configured R2 release without overwrites;\n' +
      'verify reads every CDN object back; detach removes verified paths only from Git, preserving local files/history.');
    return;
  }
  if (command === 'refresh') {
    for (const file of ['build-content-manifest.js', 'build-site-manifest.js', 'generate-image-seo-assets.js',
      'generate-symbol-hero-posters.js', 'generate-symbol-responsive-images.js', 'generate-symbol-avif-images.js',
      'generate-blog-responsive-images.js']) {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts', file)], { cwd: root, stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`Media refresh failed: ${file}`);
    }
    return main(['inventory'], root);
  }
  if (command === 'inventory') {
    const manifest = inventory(root);
    fs.writeFileSync(path.join(root, MANIFEST), `{"schema":1,"release":${JSON.stringify(manifest.release)},"files":[\n` +
      manifest.files.map(row => JSON.stringify(row)).join(',\n') + '\n]}\n');
    console.log(`[site-media] ${manifest.files.length} files, ${manifest.files.reduce((s, row) => s + row[1], 0)} bytes, release ${manifest.release}`);
    return;
  }
  if (command === 'status') {
    const media = readMedia(root);
    console.log(JSON.stringify(media && { ...media.config, release: media.manifest.release, files: media.manifest.files.length,
      bytes: media.manifest.files.reduce((s, row) => s + row[1], 0) }, null, 2));
    return;
  }
  if (command === 'hydrate') return hydrate(root);
  if (command === 'upload') return console.log(JSON.stringify(await upload(root)));
  if (command === 'verify') return console.log(JSON.stringify(await verifyRemote(root)));
  if (command === 'detach') return console.log(JSON.stringify(detach(root)));
  throw new Error('Unknown media command; see --help');
}

if (require.main === module) main().catch(error => {
  // Provider responses can contain request details: never serialize the whole error/credential object.
  console.error(`[site-media] ${error.name === 'Error' ? error.message : 'Storage request failed; check bucket permissions and connectivity'}`);
  process.exitCode = 1;
});
module.exports = { main, verifyRemote, assertRemoteReceipt, detach };
