#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

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
  return {
    port: parseNumberArg(argv, 'port', Number(process.env.PORT) || DEFAULT_PORT),
    debounceMs: parseNumberArg(argv, 'debounce', DEFAULT_DEBOUNCE_MS),
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

  if (relativePath.startsWith('docs-src/')) return true;
  if (relativePath.startsWith('data/')) return true;
  if (relativePath.startsWith('scripts/lib/')) return true;
  return /^scripts\/(?:docs|generate-|fix-guides|check-docs|validate-i18n|build-(?:content|site))/.test(relativePath);
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

  function schedule(filePath) {
    if (!filePath || !isWatchableDocsPath(filePath)) return;
    clearTimeout(timer);
    timer = setTimeout(() => onChange(filePath), debounceMs);
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
  let queued = false;
  let shuttingDown = false;

  async function rebuild(filePath = null) {
    if (building) {
      queued = true;
      return;
    }

    building = true;
    console.log(filePath ? `[docs-dev] Change detected: ${toPosixRelative(filePath)}` : '[docs-dev] Initial build');
    try {
      await runNpmScript('docs:build');
      notifyReload(clients);
      console.log('[docs-dev] Build complete. Browser reloaded.');
    } catch (error) {
      console.error(`[docs-dev] Build failed: ${error.message || error}`);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        rebuild();
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
  parseArgs,
};
