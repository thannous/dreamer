import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { contentTypeFor, resolveRequestToFile, send } from './lib/docs-preview.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8020;

export async function startDocsBrowserServer({ rootDir, port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  if (!rootDir) throw new Error('startDocsBrowserServer requires rootDir');

  const docsDir = path.join(rootDir, 'docs');
  const notFoundPath = resolveRequestToFile(docsDir, '/404.html');

  const server = http.createServer((req, res) => {
    const filePath = resolveRequestToFile(docsDir, req.url || '/');

    if (!filePath) {
      if (notFoundPath) {
        return send(res, 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, fs.readFileSync(notFoundPath));
      }
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'File not found');
    }

    const contentType = contentTypeFor(filePath);
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

  const boundPort = server.address().port;
  return {
    host,
    port: boundPort,
    url: `http://${host}:${boundPort}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
