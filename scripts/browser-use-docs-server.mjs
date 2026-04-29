import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8020;

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

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function safeJoin(root, requestPath) {
  const normalized = path.posix.normalize(requestPath.replace(/\0/g, ''));
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  const joined = path.join(root, withoutLeadingSlash);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(joined);
  return resolved.startsWith(resolvedRoot) ? resolved : null;
}

function resolveRequestToFile(docsDir, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const basePath = decoded.split('?')[0].split('#')[0];

  if (basePath.endsWith('/')) {
    const indexCandidate = safeJoin(docsDir, `${basePath}index.html`);
    return indexCandidate && existsFile(indexCandidate) ? indexCandidate : null;
  }

  const exactCandidate = safeJoin(docsDir, basePath);
  if (exactCandidate && existsFile(exactCandidate)) return exactCandidate;

  if (!path.posix.basename(basePath).includes('.')) {
    const htmlCandidate = safeJoin(docsDir, `${basePath}.html`);
    if (htmlCandidate && existsFile(htmlCandidate)) return htmlCandidate;
  }

  const dirIndexCandidate = safeJoin(docsDir, `${basePath}/index.html`);
  return dirIndexCandidate && existsFile(dirIndexCandidate) ? dirIndexCandidate : null;
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

export async function startDocsBrowserServer({ rootDir, port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  if (!rootDir) throw new Error('startDocsBrowserServer requires rootDir');

  const docsDir = path.join(rootDir, 'docs');
  const notFoundPath = safeJoin(docsDir, '/404.html');
  const has404 = Boolean(notFoundPath && existsFile(notFoundPath));

  const server = http.createServer((req, res) => {
    const filePath = resolveRequestToFile(docsDir, req.url || '/');

    if (!filePath) {
      if (has404 && notFoundPath) {
        return send(res, 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, fs.readFileSync(notFoundPath));
      }
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes.get(ext) || 'application/octet-stream';
    return send(res, 200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' }, fs.readFileSync(filePath));
  });

  await new Promise((resolve, reject) => {
    function onError(error) {
      reject(error);
    }

    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });

  return {
    host,
    port,
    url: `http://${host}:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
