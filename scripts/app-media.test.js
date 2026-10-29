const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256 } = require('./lib/site-media');
const { APP_RECEIPT, appInventory, objectKey, readAppMedia, verifyAppLocal, missingFromAppReceipt, writeAppManifest } = require('./lib/app-media');
const { uploadApp, verifyApp } = require('./site-media');

const ROOT = path.resolve(__dirname, '..');
const WEBP = (tag) => Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPVP8 '), Buffer.from(tag)]);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-media-'));
  fs.mkdirSync(path.join(root, 'docs-src/config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs-src/config/site-media-storage.json'), JSON.stringify({ schema: 1,
    accountId: 'a'.repeat(32), bucket: 'noctalia-site-media', publicOrigin: 'https://media.noctalia.app', delivery: 'cdn' }));
  const dir = path.join(root, 'assets/images/badges/app');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'moon.webp'), WEBP('full moon'));
  fs.writeFileSync(path.join(dir, 'moon-small.webp'), WEBP('small moon'));
  fs.writeFileSync(path.join(dir, 'tide.webp'), WEBP('full tide'));
  writeAppManifest(root, appInventory(root));
  return root;
}

/** An R2 stand-in answering the S3 commands putImmutable sends. */
function bucket(objects = new Map()) {
  const puts = [];
  const send = async (command) => {
    const { Key } = command.input;
    const name = command.constructor.name;
    if (name === 'HeadObjectCommand') {
      if (!objects.has(Key)) throw Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } });
      return {};
    }
    if (name === 'PutObjectCommand') {
      if (command.input.IfNoneMatch !== '*') throw new Error('unconditional write');
      if (objects.has(Key)) throw Object.assign(new Error('PreconditionFailed'), { $metadata: { httpStatusCode: 412 } });
      puts.push(command.input);
      objects.set(Key, Buffer.from(command.input.Body));
      return {};
    }
    if (name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => new Uint8Array(objects.get(Key)) } };
    throw new Error(`unexpected ${name}`);
  };
  return { client: { send }, objects, puts };
}

const served = (objects, overrides = {}) => async (url) => {
  const key = new URL(url).pathname.slice(1);
  const body = overrides[key] ?? objects.get(key);
  if (!body) return new Response('<html>Not found</html>', { status: 404, headers: { 'content-type': 'text/html' } });
  return new Response(body, { status: 200, headers: { 'content-type': 'image/webp', 'content-length': String(body.length) } });
};

describe('app media on the CDN', () => {
  it('inventories the full exports only, under content-addressed object keys', () => {
    const root = fixture();
    const media = readAppMedia(root);
    expect(Object.keys(media.manifest)).toEqual(['badges/moon', 'badges/tide']);
    const [relative, bytes, digest] = media.manifest['badges/moon'];
    expect([relative, bytes, digest]).toEqual(['assets/images/badges/app/moon.webp', WEBP('full moon').length, sha256(WEBP('full moon'))]);
    expect(objectKey(media.manifest['badges/moon'])).toBe(`app/v1/${digest}.webp`);
  });

  it('refuses rows naming anything but a committed app export, and an r2.dev origin', () => {
    const root = fixture();
    const manifest = path.join(root, 'assets/remote/app-media.json');
    const good = fs.readFileSync(manifest, 'utf8');
    fs.writeFileSync(manifest, JSON.stringify({ 'badges/moon': ['.env', 1, 'a'.repeat(64)] }));
    expect(() => readAppMedia(root)).toThrow('Invalid app media path');
    fs.writeFileSync(manifest, good);
    const config = path.join(root, 'docs-src/config/site-media-storage.json');
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('media.noctalia.app', 'pub-1.r2.dev'));
    expect(() => readAppMedia(root)).toThrow('not r2.dev');
  });

  it('uploads only missing objects, never overwriting one, and reads every object back', async () => {
    const root = fixture();
    const media = readAppMedia(root);
    const moon = objectKey(media.manifest['badges/moon']);
    const r2 = bucket(new Map([[moon, WEBP('full moon')]]));
    await expect(uploadApp(root, { client: r2.client })).resolves.toEqual({ checked: 2, uploaded: 1 });
    expect(r2.puts).toHaveLength(1);
    expect(r2.puts[0]).toMatchObject({ Key: objectKey(media.manifest['badges/tide']), ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable', IfNoneMatch: '*' });
    // A second run writes nothing.
    await expect(uploadApp(root, { client: r2.client })).resolves.toEqual({ checked: 2, uploaded: 0 });

    // An object stored with other bytes under the same key is reported, never replaced.
    r2.objects.set(moon, WEBP('other'));
    await expect(uploadApp(root, { client: r2.client })).rejects.toThrow('R2 bytes differ: badges/moon');
  });

  it('refuses to upload exports changed since the manifest', async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'assets/images/badges/app/tide.webp'), WEBP('repainted tide'));
    const r2 = bucket();
    await expect(uploadApp(root, { client: r2.client })).rejects.toThrow('App media changed; run app-inventory: badges/tide');
    expect(r2.puts).toHaveLength(0);
  });

  it('records a receipt only once every object is read back from the CDN, which the release gate requires', async () => {
    const root = fixture();
    const media = readAppMedia(root);
    const r2 = bucket();
    await uploadApp(root, { client: r2.client });
    expect(missingFromAppReceipt(root)).toEqual(['badges/moon', 'badges/tide']);

    // A missing key answers an HTML 404: no receipt.
    const tide = objectKey(media.manifest['badges/tide']);
    const missing = new Map(r2.objects);
    missing.delete(tide);
    await expect(verifyApp(root, { fetcher: served(missing) })).rejects.toThrow('Media response invalid (404)');
    expect(fs.existsSync(path.join(root, APP_RECEIPT))).toBe(false);
    await expect(verifyApp(root, { fetcher: served(r2.objects, { [tide]: WEBP('full tidE') }) })).rejects.toThrow('Media digest mismatch');

    const receipt = await verifyApp(root, { fetcher: served(r2.objects) });
    expect(receipt).toMatchObject({ origin: 'https://media.noctalia.app', checked: 2, objects: [...r2.objects.keys()].sort() });
    expect(missingFromAppReceipt(root)).toEqual([]);

    // A new painting is missing again until it is published.
    fs.writeFileSync(path.join(root, 'assets/images/badges/app/star.webp'), WEBP('full star'));
    writeAppManifest(root, appInventory(root));
    expect(missingFromAppReceipt(root)).toEqual(['badges/star']);
  });

  it('commits a manifest naming exactly the exports in the checkout', () => {
    // Re-exported paintings need `npm run docs:media -- app-inventory`, then an upload.
    expect(readAppMedia(ROOT).manifest).toEqual(appInventory(ROOT));
    expect(() => verifyAppLocal(ROOT)).not.toThrow();
  });
});
