#!/usr/bin/env node


'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { markDocsBuildStarted, markDocsBuildSucceeded, markDocsBuildFailed } = require('./lib/docs-check-helpers');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const DEFAULT_PORT = 8000;
const DEFAULT_DEBOUNCE_MS = 500;
const DEV_EVENT_PATH = '/.docs-dev/events';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function parseNumberArg(argv, name, fallback) {
  const prefix = `--${name}=`;
  const arg = argv.find((item) => item.startsWith(prefix));
  const value = arg ? Number(arg.slice(prefix.length)) : undefined;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseArgs(argv = process.argv.slice(2)) {
  const symbol = argv.find((arg) => arg.startsWith('--symbol='))?.slice('--symbol='.length) || null;
  const lang = argv.find((arg) => arg.startsWith('--lang='))?.slice('--lang='.length) || null;
  if (symbol && !/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(symbol)) throw new Error('Invalid --symbol (use comma-separated symbol ids).');
  if (lang && !/^[a-z]{2}(?:-[a-z]{2})?$/.test(lang)) throw new Error('Invalid --lang.');
  if (lang && !symbol) throw new Error('--lang requires --symbol.');
  if (symbol) {
    const { siteConfig } = require('./lib/docs-site-config');
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/dream-symbols.json'), 'utf8'));
    const ids = new Set(catalog.symbols.map((entry) => entry.id));
    if (symbol.split(',').some((id) => !ids.has(id))) throw new Error('Unknown --symbol id.');
    if (lang && !siteConfig.collections.symbols.languages.includes(lang)) throw new Error('Unsupported symbol --lang.');
  }
  return {
    port: parseNumberArg(argv, 'port', Number(process.env.PORT) || DEFAULT_PORT),
    debounceMs: parseNumberArg(argv, 'debounce', DEFAULT_DEBOUNCE_MS),
    symbol,
    lang,
  };
}

function safeJoin(root, requestPath) {
  const cleaned = requestPath.replace(/\0/g, '');
  const normalized = path.posix.normalize(cleaned);
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  const joined = path.join(root, withoutLeadingSlash);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(joined);
  if (!resolved.startsWith(resolvedRoot)) return null;
  return resolved;
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveRequestToFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const basePath = decoded.split('?')[0].split('#')[0];

  if (basePath.endsWith('/')) {
    const indexCandidate = safeJoin(DOCS_DIR, `${basePath}index.html`);
    if (indexCandidate && existsFile(indexCandidate)) return indexCandidate;
    return null;
  }

  const exactCandidate = safeJoin(DOCS_DIR, basePath);
  if (exactCandidate && existsFile(exactCandidate)) return exactCandidate;

  if (!path.posix.basename(basePath).includes('.')) {
    const htmlCandidate = safeJoin(DOCS_DIR, `${basePath}.html`);
    if (htmlCandidate && existsFile(htmlCandidate)) return htmlCandidate;
  }

  const dirIndexCandidate = safeJoin(DOCS_DIR, `${basePath}/index.html`);
  if (dirIndexCandidate && existsFile(dirIndexCandidate)) return dirIndexCandidate;

  return null;
}

function injectLiveReloadClient(html) {
  const snippet = [
    '<script>',
    '(function(){',
    `var events = new EventSource('${DEV_EVENT_PATH}');`,
    "events.addEventListener('reload', function(){ window.location.reload(); });",
    "events.addEventListener('error', function(){ console.debug('[docs-dev] waiting for dev server'); });",
    '}());',
    '</script>',
  ].join('');

  if (html.includes('</body>')) {
    return html.replace('</body>', `${snippet}</body>`);
  }

  return `${html}${snippet}`;
}

function toPosixRelative(filePath, rootDir = ROOT_DIR) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function isWatchableDocsPath(filePath, rootDir = ROOT_DIR) {
  const relativePath = toPosixRelative(filePath, rootDir);
  if (!relativePath || relativePath.startsWith('..')) return false;
  if (relativePath.startsWith('docs/')) return false;
  if (relativePath.startsWith('node_modules/')) return false;
  if (relativePath.startsWith('tmp/')) return false;
  if (relativePath.startsWith('%TEMP%/')) return false;
  // Windows also reports the js container when the experience bundle changes.
  // Its files have their own watchers; this metadata event would rebuild forever.
  if (relativePath === 'docs-src/static/js') return false;

  // Build outputs living under watched roots: docs:build rewrites them on
  // every run, so watching them would make each build queue the next one
  // forever. Match the directories themselves too — build-experience removes
  // and recreates its output directory, which fires an event on the parent
  // with the bare directory path.
  const generatedOutputs = [
    'docs-src/static/js/experience',
    'docs-src/static/img/seo',
    'docs-src/static/img/symbols/posters-v1',
  ];
  if (
    generatedOutputs.some(
      (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)
    )
  ) {
    return false;
  }
  if (relativePath === 'data/content-manifest.json') return false;
  if (relativePath === 'data/site-manifest.json') return false;

  if (relativePath.startsWith('docs-src/')) return true;
  if (relativePath.startsWith('data/')) return true;
  if (relativePath.startsWith('scripts/lib/')) return true;
  return /^scripts\/(?:docs|generate-|check-docs|validate-i18n|build-(?:content|site|guides))/.test(relativePath);
}

function walkDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const dirs = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    dirs.push(current);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
    }
  }

  return dirs;
}

function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const npmExecPath = process.env.npm_execpath;
    const command = npmExecPath && existsFile(npmExecPath) ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = npmExecPath && existsFile(npmExecPath) ? [npmExecPath, 'run', scriptName] : ['run', scriptName];
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: !npmExecPath && process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run ${scriptName} failed with exit code ${code}`));
    });
  });
}

const SYMBOL_GENERATOR = 'docs-src/static/scripts/generate-symbol-pages.js';

function canRebuildSymbols(options, changedPaths) {
  return Boolean(options.symbol && changedPaths?.length && changedPaths.every((file) => file === SYMBOL_GENERATOR));
}

function rebuildSymbols(options) {
  const target = path.join(DOCS_DIR, 'scripts', 'generate-symbol-pages.js');
  fs.copyFileSync(path.join(ROOT_DIR, SYMBOL_GENERATOR), target);
  const args = [target, `--id=${options.symbol}`];
  if (options.lang) args.push(`--lang=${options.lang}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT_DIR, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0 && !signal) resolve();
      else reject(new Error(`Symbol rebuild failed (${signal || code}).`));
    });
  });
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function createDocsServer({ port, clients }) {
  const notFoundPath = safeJoin(DOCS_DIR, '/404.html');
  const has404 = Boolean(notFoundPath && existsFile(notFoundPath));

  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/';

    if (urlPath.split('?')[0] === DEV_EVENT_PATH) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('event: ready\ndata: ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    const filePath = resolveRequestToFile(urlPath);
    if (!filePath) {
      if (has404 && notFoundPath) {
        return send(res, 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, fs.readFileSync(notFoundPath));
      }
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes.get(ext) || 'application/octet-stream';
    const data = fs.readFileSync(filePath);

    if (ext === '.html') {
      return send(
        res,
        200,
        { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
        injectLiveReloadClient(data.toString('utf8'))
      );
    }

    return send(res, 200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' }, data);
  });

  return new Promise((resolve, reject) => {
    function onError(error) {
      reject(error);
    }

    server.once('error', onError);
    server.listen(port, () => {
      server.off('error', onError);
      resolve(server);
    });
  });
}

function notifyReload(clients) {
  for (const client of clients) {
    client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  }
}

function watchDocsSources({ debounceMs, onChange }) {
  const roots = ['docs-src', 'data', 'scripts'].map((item) => path.join(ROOT_DIR, item));
  const watchers = [];
  let timer = null;
  const changes = new Set();

  function schedule(filePath) {
    if (!filePath || !isWatchableDocsPath(filePath)) return;
    changes.add(toPosixRelative(filePath));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const batch = [...changes];
      changes.clear();
      onChange(batch);
    }, debounceMs);
  }

  for (const root of roots) {
    for (const dirPath of walkDirs(root)) {
      const watcher = fs.watch(dirPath, (eventType, filename) => {
        if (!filename) return;
        schedule(path.join(dirPath, filename.toString()));
      });
      watchers.push(watcher);
    }
  }

  return () => {
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
  };
}

async function main() {
  const options = parseArgs();
  const clients = new Set();
  let building = false;
  const queued = new Set();
  let shuttingDown = false;
  let buildReady = false;

  async function rebuild(changedPaths = null) {
    if (building) {
      for (const file of changedPaths || []) queued.add(file);
      return;
    }

    building = true;
    const targeted = buildReady && canRebuildSymbols(options, changedPaths);
    console.log(changedPaths ? `[docs-dev] Changes detected: ${changedPaths.join(', ')}` : '[docs-dev] Initial build');
    const started = Date.now();
    try {
      if (targeted) {
        markDocsBuildStarted(ROOT_DIR);
        await rebuildSymbols(options);
        markDocsBuildSucceeded(ROOT_DIR, { partial: true });
      } else {
        await runNpmScript('docs:build');
      }
      buildReady = true;
      notifyReload(clients);
      console.log(`[docs-dev] ${targeted ? 'Selected symbols' : 'Full build'} complete in ${Date.now() - started} ms. Browser reloaded.`);
    } catch (error) {
      buildReady = false;
      markDocsBuildFailed(ROOT_DIR, error);
      console.error(`[docs-dev] Build failed: ${error.message || error}`);
    } finally {
      building = false;
      if (queued.size && !shuttingDown) {
        const next = [...queued];
        queued.clear();
        rebuild(next);
      }
    }
  }

  await rebuild();
  const server = await createDocsServer({ port: options.port, clients });
  const stopWatching = watchDocsSources({ debounceMs: options.debounceMs, onChange: rebuild });
  const keepAlive = setInterval(() => {}, 60 * 60 * 1000);

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[docs-dev] ${signal} received. Stopping dev server.`);
    stopWatching();
    clearInterval(keepAlive);
    for (const client of clients) client.end();
    clients.clear();

    await new Promise((resolve) => {
      server.close((error) => {
        if (error) console.error(`[docs-dev] Server close failed: ${error.message || error}`);
        resolve();
      });
    });

    process.exit(0);
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  console.log(`Serving docs with live reload at http://localhost:${options.port}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[docs-dev] Failed: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  DEV_EVENT_PATH,
  injectLiveReloadClient,
  isWatchableDocsPath,
  canRebuildSymbols,
  parseArgs,
};
