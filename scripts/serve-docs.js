#!/usr/bin/env node

/**
 * Static server for `docs/` that supports "pretty URLs":
 * - `/fr/mentions-legales` -> `/docs/fr/mentions-legales.html`
 * - `/fr/blog/` -> `/docs/fr/blog/index.html`
 *
 * This mirrors the Netlify `_redirects` behavior in local dev.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const DEFAULT_PORT = 8000;

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
  ['.xml', 'application/xml; charset=utf-8']
]);

function parsePort() {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  const fromArg = arg ? Number(arg.split('=')[1]) : undefined;
  const fromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = fromArg ?? fromEnv ?? DEFAULT_PORT;
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function safeJoin(root, requestPath) {
  const cleaned = requestPath.replace(/\0/g, '');
  const normalized = path.posix.normalize(cleaned);
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  const joined = path.join(root, withoutLeadingSlash);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(joined);
  if (!resolved.startsWith(resolvedRoot)) {
    return null;
  }
  return resolved;
}

function existsFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
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

  // Exact match (assets, etc.)
  const exactCandidate = safeJoin(DOCS_DIR, basePath);
  if (exactCandidate && existsFile(exactCandidate)) return exactCandidate;

  // Pretty URL: try `.html`
  if (!path.posix.basename(basePath).includes('.')) {
    const htmlCandidate = safeJoin(DOCS_DIR, `${basePath}.html`);
    if (htmlCandidate && existsFile(htmlCandidate)) return htmlCandidate;
  }

  // Directory index
  const dirIndexCandidate = safeJoin(DOCS_DIR, `${basePath}/index.html`);
  if (dirIndexCandidate && existsFile(dirIndexCandidate)) return dirIndexCandidate;

  return null;
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function main() {
  const port = parsePort();

  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/';

    const filePath = resolveRequestToFile(urlPath);
    if (!filePath) {
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes.get(ext) || 'application/octet-stream';

    try {
      const data = fs.readFileSync(filePath);
      return send(
        res,
        200,
        {
          'Content-Type': contentType,
          'Cache-Control': 'no-store'
        },
        data
      );
    } catch (error) {
      return send(
        res,
        500,
        { 'Content-Type': 'text/plain; charset=utf-8' },
        `Server error: ${String(error && error.message ? error.message : error)}`
      );
    }
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`✅ Serving docs at http://localhost:${port} (pretty URLs enabled)`);
  });
}

main();

