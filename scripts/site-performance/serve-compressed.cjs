#!/usr/bin/env node
'use strict';
// Report-only loopback server for generated docs/: clean URLs, Brotli/gzip and
// the long-lived asset caching of _headers, so lab transfer sizes approximate
// a CDN. It is not Cloudflare and never a production observation.
// Usage: node scripts/site-performance/serve-compressed.cjs <docs-dir> [port]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(process.argv[2] || 'docs');
const port = Number(process.argv[3] || 8530);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.xml': 'application/xml',
};
const compressible = /^(text\/|application\/(json|xml)|image\/svg)/;

const resolveFile = (pathname) => {
  const base = path.join(root, decodeURIComponent(pathname));
  if (!base.startsWith(root)) return null;
  return [base, path.join(base, 'index.html'), `${base}.html`].find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) || null;
};

http.createServer((request, response) => {
  const file = resolveFile(new URL(request.url, 'http://localhost').pathname);
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const type = types[path.extname(file)] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': type.startsWith('text/html') ? 'public, max-age=0, must-revalidate' : 'public, max-age=31556952, immutable',
  };
  let body = fs.readFileSync(file);
  const accepted = request.headers['accept-encoding'] || '';
  if (compressible.test(type)) {
    headers.Vary = 'Accept-Encoding';
    if (/\bbr\b/.test(accepted)) {
      body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      headers['Content-Encoding'] = 'br';
    } else if (/gzip/.test(accepted)) {
      body = zlib.gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
  }
  const range = !headers['Content-Encoding'] && /bytes=(\d*)-(\d*)/.exec(request.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : body.length - 1;
    headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
    headers['Content-Length'] = end - start + 1;
    response.writeHead(206, headers);
    response.end(body.subarray(start, end + 1));
    return;
  }
  headers['Content-Length'] = body.length;
  response.writeHead(200, headers);
  response.end(body);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://localhost:${port}`));
