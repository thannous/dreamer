#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const plist = require('plist');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, '.tmp/ios-local-ota');
const SITE = path.join(OUTPUT, 'site');
const BUNDLE = 'com.tanuki75.noctalia';
const LOCAL_PORT = 8765;
const HTTPS_PORT = 8443;

function execute(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${result.error.message}${detail ? `\n${detail}` : ''}`);
  }
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result.stdout || '';
}

function tailscale(args) {
  const command = process.env.TAILSCALE_BIN || (process.platform === 'darwin'
    ? '/Applications/Tailscale.app/Contents/MacOS/Tailscale' : 'tailscale');
  return execute(command, args, { env: { ...process.env, TAILSCALE_BE_CLI: '1' }, timeout: 10000 });
}

function readTailnet() {
  const status = JSON.parse(tailscale(['status', '--json']));
  const hostname = String(status.Self?.DNSName || '').replace(/\.$/, '');
  if (status.BackendState !== 'Running' || !hostname.endsWith('.ts.net')) {
    throw new Error('Connect Tailscale on this Mac before using private OTA.');
  }
  return {
    hostname, url: `https://${hostname}:${HTTPS_PORT}`,
    httpsAvailable: Boolean(status.CertDomains?.includes(hostname)),
    enableServeUrl: `https://login.tailscale.com/f/serve?node=${encodeURIComponent(status.Self.ID)}`,
  };
}

function assertBuildReady(readiness, team) {
  if (!readiness.nativeProject) throw new Error('The native iOS project is missing; no prebuild will be run.');
  if (!readiness.signingIdentities) throw new Error('No valid Apple signing identity on this Mac. Configure signing in Xcode first.');
  if (!/^[A-Z0-9]{10}$/.test(team || '')) throw new Error('Provide your Apple team with --team <TEAM_ID>.');
  if (readiness.remoteUpdatesEnabled === true) throw new Error('Disable remote updates in ios/Noctalia/Supporting/Expo.plist for this local binary OTA workflow.');
}

function readReadiness() {
  const identities = execute('security', ['find-identity', '-v', '-p', 'codesigning']);
  const signingIdentities = Number(identities.match(/(\d+) valid identities found/)?.[1] || 0);
  const nativeProject = fs.existsSync(path.join(ROOT, 'ios/Noctalia.xcworkspace'));
  const nativeUpdates = nativeProject
    ? JSON.parse(execute('plutil', ['-convert', 'json', '-o', '-', path.join(ROOT, 'ios/Noctalia/Supporting/Expo.plist')])) : null;
  const remoteUpdatesEnabled = nativeUpdates?.EXUpdatesEnabled !== false;
  const podsInstalled = fs.existsSync(path.join(ROOT, 'ios/Pods/Manifest.lock'));
  return {
    nativeProject, signingIdentities, podsInstalled, remoteUpdatesEnabled,
    sourceRevision: execute('git', ['rev-parse', 'HEAD']).trim(),
    xcode: execute('xcodebuild', ['-version']).trim(),
    tailscale: readTailnet(),
    readyToBuild: nativeProject && signingIdentities > 0 && podsInstalled && !remoteUpdatesEnabled,
  };
}

function assertPrivateServe(configuration, hostname) {
  if (Object.entries(configuration.AllowFunnel || {}).some(([key, enabled]) => enabled && key.endsWith(`:${HTTPS_PORT}`))) {
    throw new Error(`Funnel exposes port ${HTTPS_PORT}; disable it before using private OTA.`);
  }
  const tcp = configuration.TCP?.[HTTPS_PORT];
  const entries = Object.entries(configuration.Web || {}).filter(([key]) => key.endsWith(`:${HTTPS_PORT}`));
  const handlers = configuration.Web?.[`${hostname}:${HTTPS_PORT}`]?.Handlers;
  const matches = tcp?.HTTPS === true && !tcp.TCPForward && entries.length === 1 &&
    handlers?.['/']?.Proxy === `http://127.0.0.1:${LOCAL_PORT}` && Object.keys(handlers).length === 1;
  if ((tcp || entries.length) && !matches) throw new Error(`Port ${HTTPS_PORT} already serves another service. Its configuration was preserved.`);
  return Boolean(matches);
}

function validateManifest(metadata, xml, ipaUrl) {
  if (new URL(ipaUrl).protocol !== 'https:') throw new Error('OTA requires an HTTPS IPA URL.');
  if (metadata.bundleIdentifier !== BUNDLE) throw new Error('The binary must belong to Noctalia.');
  const item = plist.parse(xml).items?.[0];
  if (item?.metadata?.['bundle-identifier'] !== metadata.bundleIdentifier ||
      item.metadata['bundle-version'] !== metadata.version ||
      item.metadata['platform-identifier'] !== 'com.apple.platform.iphoneos' ||
      item.assets?.find((asset) => asset.kind === 'software-package')?.url !== ipaUrl) {
    throw new Error('The Xcode manifest must match the exported iOS binary and HTTPS IPA URL.');
  }
  return xml;
}

function validateProfile(profile, udid) {
  if (!(profile.ExpirationDate instanceof Date) || profile.ExpirationDate <= new Date()) {
    throw new Error('The provisioning profile is expired or has no valid expiry.');
  }
  if (!udid || !profile.ProvisionedDevices?.includes(udid)) {
    throw new Error('The profile must include this registered iPhone; Store profiles cannot be used.');
  }
  if (!profile.Entitlements?.['application-identifier']?.endsWith(`.${BUNDLE}`)) {
    throw new Error('The provisioning profile must belong to Noctalia.');
  }
}

function readDevice(selector) {
  if (!selector) throw new Error('Select the paired iPhone with --device <name or UDID>.');
  const data = JSON.parse(execute('xcrun', ['devicectl', 'list', 'devices', '--timeout', '15', '--json-output', '-']));
  const device = data.result?.devices?.find((item) => [item.identifier, item.hardwareProperties?.udid, item.deviceProperties?.name].includes(selector));
  if (!device?.hardwareProperties?.udid || device.hardwareProperties.reality !== 'physical') {
    throw new Error('A paired physical iPhone matching --device is required.');
  }
  return device.hardwareProperties.udid;
}

function build(team, deviceName, provision = false, localVersion, localBuild) {
  const readiness = readReadiness();
  assertBuildReady(readiness, team);
  const versionOverrides = [];
  if (localVersion || localBuild) {
    if (!/^\d+\.\d+\.\d+$/.test(localVersion || '') || !/^\d+(?:\.\d+){0,2}$/.test(localBuild || '')) {
      throw new Error('Provide both --version X.Y.Z and --build-number N for a distinct local iPhone update.');
    }
    versionOverrides.push(`MARKETING_VERSION=${localVersion}`, `CURRENT_PROJECT_VERSION=${localBuild}`);
  }
  if (!readiness.podsInstalled) throw new Error('Install the existing iOS pods before building.');
  if (!fs.readFileSync(path.join(ROOT, 'ios/Podfile.lock')).equals(fs.readFileSync(path.join(ROOT, 'ios/Pods/Manifest.lock')))) {
    throw new Error('The installed pods do not match Podfile.lock. Reconcile them before building.');
  }
  const udid = readDevice(deviceName);
  const run = path.join(OUTPUT, 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(run, { recursive: true });
  const archive = path.join(run, 'Noctalia.xcarchive');
  const exported = path.join(run, 'export');
  const exportOptions = path.join(run, 'ExportOptions.plist');
  const releaseUrl = `${readiness.tailscale.url}/releases/${path.basename(run)}`;
  const icon = path.resolve(ROOT, JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.icon);
  if (!fs.existsSync(icon)) throw new Error('The Noctalia application icon is missing.');
  fs.writeFileSync(exportOptions, plist.build({
    method: 'debugging', teamID: team, signingStyle: 'automatic', manageAppVersionAndBuildNumber: false,
    manifest: { appURL: `${releaseUrl}/Noctalia.ipa`, displayImageURL: `${releaseUrl}/icon.png`, fullSizeImageURL: `${releaseUrl}/icon.png` },
  }));
  for (const [stage, args] of [
    ['archive', ['-workspace', 'ios/Noctalia.xcworkspace', '-scheme', 'Noctalia', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-derivedDataPath', path.join(OUTPUT, 'DerivedData'), '-archivePath', archive, `DEVELOPMENT_TEAM=${team}`, 'CODE_SIGN_STYLE=Automatic', ...versionOverrides, 'archive']],
    ['export', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', exportOptions, '-exportPath', exported]],
  ]) {
    console.log(`[ios-local] ${stage}; log: ${path.join(run, `${stage}.log`)}`);
    const fd = fs.openSync(path.join(run, `${stage}.log`), 'w', 0o600);
    try { execute('xcodebuild', provision ? [...args, '-allowProvisioningUpdates'] : args, { timeout: 30 * 60 * 1000, stdio: ['ignore', fd, fd] }); }
    catch (error) {
      const logTail = fs.readFileSync(path.join(run, `${stage}.log`), 'utf8').slice(-6000);
      fs.writeFileSync(path.join(run, 'failure.json'), JSON.stringify({ stage, sourceRevision: readiness.sourceRevision, error: error.message, logTail }, null, 2));
      throw new Error(`Local ${stage} failed. Read its log before retrying.`);
    } finally { fs.closeSync(fd); }
  }
  const ipaFiles = fs.readdirSync(exported).filter((file) => file.endsWith('.ipa'));
  if (ipaFiles.length !== 1) throw new Error('Expected one exported IPA.');
  const ipa = path.join(exported, ipaFiles[0]);
  const verify = path.join(run, 'verify');
  execute('ditto', ['-x', '-k', ipa, verify]);
  const apps = fs.readdirSync(path.join(verify, 'Payload')).filter((file) => file.endsWith('.app'));
  if (apps.length !== 1) throw new Error('Expected one application in the exported IPA.');
  const app = path.join(verify, 'Payload', apps[0]);
  execute('codesign', ['--verify', '--deep', '--strict', app]);
  const info = JSON.parse(execute('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Info.plist')]));
  if (localVersion && (info.CFBundleShortVersionString !== localVersion || info.CFBundleVersion !== localBuild)) {
    throw new Error('The exported binary does not match the requested local version/build.');
  }
  const embeddedUpdates = JSON.parse(execute('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Expo.plist')]));
  if (embeddedUpdates.EXUpdatesEnabled !== false) throw new Error('The exported binary must have remote updates disabled.');
  const profile = plist.parse(execute('security', ['cms', '-D', '-i', path.join(app, 'embedded.mobileprovision')]));
  validateProfile(profile, udid);
  const metadata = {
    bundleIdentifier: info.CFBundleIdentifier, version: info.CFBundleShortVersionString,
    build: info.CFBundleVersion, title: info.CFBundleDisplayName || info.CFBundleName,
    sourceRevision: readiness.sourceRevision,
    artifactId: path.basename(run),
    remoteUpdatesEnabled: false,
  };
  const releaseSite = path.join(SITE, 'releases', metadata.artifactId);
  const manifest = validateManifest(metadata, fs.readFileSync(path.join(exported, 'manifest.plist'), 'utf8'), `${releaseUrl}/Noctalia.ipa`);
  fs.mkdirSync(releaseSite, { recursive: true });
  fs.copyFileSync(ipa, path.join(releaseSite, 'Noctalia.ipa'));
  fs.copyFileSync(icon, path.join(releaseSite, 'icon.png'));
  fs.writeFileSync(path.join(releaseSite, 'manifest.plist'), manifest);
  // Publish a pointer only after immutable release files are complete.
  fs.writeFileSync(path.join(SITE, 'build.json.tmp'), JSON.stringify(metadata, null, 2));
  fs.renameSync(path.join(SITE, 'build.json.tmp'), path.join(SITE, 'build.json'));
  console.log(`IPA verified and prepared: ${readiness.tailscale.url}/`);
}

function page(metadata, url) {
  const install = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${url}/releases/${metadata?.artifactId}/manifest.plist`)}`;
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Noctalia · iPhone</title><style>body{font:18px system-ui;max-width:32rem;margin:12vh auto;padding:24px;background:#17111f;color:#f7f3ed}h1{font-size:32px}p{line-height:1.6}a{display:inline-block;background:#f7f3ed;color:#17111f;padding:14px 22px;border-radius:12px;text-decoration:none}</style><h1>Noctalia sur ton iPhone</h1><p>${metadata ? `Version ${metadata.version.replace(/[^\w.-]/g, '')} · build ${String(metadata.build).replace(/[^\w.-]/g, '')}` : 'Aucun binaire disponible. La signature Apple doit être configurée sur le Mac.'}</p>${metadata ? `<a href="${install}">Installer sur cet iPhone</a>` : ''}<p>Garde Tailscale connecté pendant le téléchargement.</p></html>`;
}

function serve() {
  const tailnet = readTailnet();
  if (!tailnet.httpsAvailable) {
    throw new Error(`Tailscale Serve needs activation for this Mac: ${tailnet.enableServeUrl}`);
  }
  const existing = assertPrivateServe(JSON.parse(tailscale(['serve', 'status', '--json'])), tailnet.hostname);
  fs.mkdirSync(SITE, { recursive: true });
  const server = http.createServer((request, response) => {
    response.on('finish', () => {
      const event = {
        time: new Date().toISOString(), method: request.method,
        status: response.statusCode,
        iphone: /iPhone/.test(request.headers['user-agent'] || ''),
        artifactId: request.url?.match(/^\/releases\/([\w-]+)\//)?.[1] || null,
        resource: {
          'text/html; charset=utf-8': 'page', 'application/json': 'health',
          'text/xml; charset=utf-8': 'manifest', 'application/octet-stream': 'ipa',
          'image/png': 'icon',
        }[response.getHeader('Content-Type')] || 'other',
      };
      try { fs.appendFileSync(path.join(OUTPUT, 'requests.jsonl'), `${JSON.stringify(event)}\n`); }
      catch (error) { console.error(`Unable to record HTTP evidence: ${error.message}`); }
    });
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    const candidate = fs.existsSync(path.join(SITE, 'build.json'))
      ? JSON.parse(fs.readFileSync(path.join(SITE, 'build.json'), 'utf8')) : null;
    const ready = candidate && /^[\w-]+$/.test(candidate.artifactId) &&
      ['manifest.plist', 'Noctalia.ipa', 'icon.png'].every((file) => fs.existsSync(path.join(SITE, 'releases', candidate.artifactId, file)));
    const metadata = ready ? candidate : null;
    if (pathname === '/' || pathname === '/healthz') {
      const content = pathname === '/' ? page(metadata, tailnet.url) : JSON.stringify({ ready: Boolean(ready), ...metadata });
      response.setHeader('Content-Type', pathname === '/' ? 'text/html; charset=utf-8' : 'application/json');
      response.end(request.method === 'HEAD' ? undefined : content);
      return;
    }
    const release = pathname.match(/^\/releases\/[\w-]+\/(Noctalia\.ipa|manifest\.plist|icon\.png)$/);
    const file = path.join(SITE, pathname.slice(1));
    if (!release || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', release[1].endsWith('.ipa') ? 'application/octet-stream' : release[1].endsWith('.png') ? 'image/png' : 'text/xml; charset=utf-8');
    response.setHeader('Content-Length', fs.statSync(file).size);
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
  });
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(LOCAL_PORT, '127.0.0.1', () => {
    try {
      if (!existing) tailscale(['serve', '--bg', `--https=${HTTPS_PORT}`, '--yes', `http://127.0.0.1:${LOCAL_PORT}`]);
      if (!assertPrivateServe(JSON.parse(tailscale(['serve', 'status', '--json'])), tailnet.hostname)) throw new Error('Private HTTPS forwarding was not configured.');
      console.log(`Private iPhone OTA page: ${tailnet.url}/`);
      console.log('The server stays in the foreground. Ctrl+C stops the local server.');
    } catch (error) { console.error(error.message); process.exitCode = 1; server.close(); }
  });
}

function main(argv = process.argv.slice(2)) {
  const [action, ...args] = argv;
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--provision') { options.provision = true; continue; }
    if (!['--team', '--device', '--version', '--build-number'].includes(args[index]) || !args[index + 1]) throw new Error('Use --team TEAM_ID, --device NAME, --version X.Y.Z and/or --build-number N.');
    options[args[index].slice(2)] = args[++index];
  }
  if (action === 'check') console.log(JSON.stringify(readReadiness(), null, 2));
  else if (action === 'build') build(options.team, options.device, options.provision, options.version, options['build-number']);
  else if (action === 'serve') serve();
  else if (action === 'launch') {
    readDevice(options.device);
    console.log(execute('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', options.device, '--timeout', '20', BUNDLE]));
  } else throw new Error('Usage: ios-local-ota.js check|build|serve|launch [--team TEAM_ID] [--device NAME] [--version X.Y.Z --build-number N] [--provision]');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { assertBuildReady, assertPrivateServe, validateManifest, validateProfile };
