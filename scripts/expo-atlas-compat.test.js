const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const semver = require('semver');

// Atlas0.5.0 asks for expo-server57. Keep its real HTTP contract covered while
// the scoped override aligns it with the app's SDK instead of hiding duplicates.
test('Atlas resolves the installed SDK server and serves its UI and bundle API', async () => {
  const atlasRequire = createRequire(require.resolve('expo-atlas/package.json'));
  const serverVersion = atlasRequire('expo-server/package.json').version;
  const supported = require('expo/bundledNativeModules.json')['expo-server'];
  assert(semver.satisfies(serverVersion, supported), `${serverVersion} must satisfy ${supported}`);

  const { createAtlasMiddleware } = require('expo-atlas');
  const previousSource = global.EXPO_ATLAS_SOURCE;
  const bundle = {
    id: 'synthetic-android', platform: 'android', environment: 'client',
    projectRoot: '/synthetic', sharedRoot: '/synthetic', entryPoint: '/synthetic/index.js',
    runtimeModules: [], modules: new Map(),
  };
  const middleware = createAtlasMiddleware({
    listBundles: () => [bundle], getBundle: () => bundle,
    hasHmrSupport: () => false, getBundleHmr: () => null,
  });
  const server = createServer(middleware);
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const ui = await fetch(`${base}/`);
    assert.equal(ui.status, 200);
    assert.match(ui.headers.get('content-type'), /text\/html/);
    assert.match(await ui.text(), /<html/);
    const bundles = await fetch(`${base}/--/bundles`);
    assert.equal(bundles.status, 200);
    const payload = await bundles.json();
    assert.match(JSON.stringify(payload), /synthetic-android/);
    const modules = await fetch(`${base}/--/bundles/synthetic-android/modules`);
    assert.equal(modules.status, 200);
    assert.match(modules.headers.get('content-type'), /application\/json/);
    await modules.json();
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    global.EXPO_ATLAS_SOURCE = previousSource;
  }
});
