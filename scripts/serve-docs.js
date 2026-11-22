#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { readMedia, publicUrl, assertRemoteReceipt } = require('./lib/site-media');
const { contentTypeFor, resolveRequestToFile, send } = require('./lib/docs-preview');

const DOCS_DIR = path.join(__dirname, '../docs');
const DEFAULT_PORT = 8000;

function parsePort() {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  const fromArg = arg ? Number(arg.split('=')[1]) : undefined;
  const fromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = fromArg ?? fromEnv ?? DEFAULT_PORT;
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function main() {
  const media = readMedia(path.resolve(__dirname, '..'));
  if (media?.config.delivery === 'cdn') assertRemoteReceipt(path.resolve(__dirname, '..'), media);
  const port = parsePort();
  const host = process.argv.find((arg) => arg.startsWith('--host='))?.slice(7) || '127.0.0.1';
  const notFoundPath = resolveRequestToFile(DOCS_DIR, '/404.html');

  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/';
    const imagePath = new URL(urlPath, 'http://preview.local').pathname.replace(/^\/+/, '');
    if (media?.config.delivery === 'cdn' && media.paths.has(imagePath)) {
      return send(res, 302, { Location: publicUrl(media, imagePath), 'Cache-Control': 'no-store' }, '');
    }

    const filePath = resolveRequestToFile(DOCS_DIR, urlPath);
    if (!filePath) {
      if (notFoundPath) {
        try {
          const data = fs.readFileSync(notFoundPath);
          return send(
            res,
            404,
            {
              'Content-Type': 'text/html; charset=utf-8',
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
      }

      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'File not found');
    }

    const contentType = contentTypeFor(filePath);

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

  server.listen(port, host, () => {

    console.log(`✅ Serving docs at http://${host}:${port} (pretty URLs enabled)`);
  });
}

main();
