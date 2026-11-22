const fs = require('node:fs');
const path = require('node:path');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.avif', 'image/avif'],
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

function existsFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function resolveRequestToFile(root, urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split(/[?#]/, 1)[0]);
  } catch {
    return null;
  }

  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  const base = path.resolve(root, normalized);
  const relative = path.relative(root, base);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return null;
  if (pathname.endsWith('/')) {
    const index = path.join(base, 'index.html');
    return existsFile(index) ? index : null;
  }
  if (existsFile(base)) return base;
  if (relative && !path.basename(base).includes('.') && existsFile(base + '.html')) return base + '.html';
  const index = path.join(base, 'index.html');
  return existsFile(index) ? index : null;
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

module.exports = { contentTypeFor, existsFile, resolveRequestToFile, send };
