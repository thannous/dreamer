const fs = require('node:fs');
const path = require('node:path');
const { toPosix } = require('./docs-source-utils');

function indexDocsFiles(root, { includeTemplates = false } = {}) {
  const files = new Set();
  const directories = [root];
  const ignored = new Set(['node_modules', '.git']);
  if (!includeTemplates) ignored.add('templates');
  while (directories.length) {
    const directory = directories.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !ignored.has(entry.name)) directories.push(fullPath);
      if (entry.isFile()) files.add(toPosix(path.relative(root, fullPath)));
    }
  }
  return files;
}

function stripQueryAndHash(pathname) {
  const end = pathname.search(/[?#]/);
  return end < 0 ? pathname : pathname.slice(0, end);
}

function isSkippableUrl(raw) {
  const url = String(raw || '').trim();
  return !url || url.includes('{{') || url.includes('}}') || /^(?:mailto|tel|sms|javascript|data):/i.test(url);
}

function resolveLinkTarget(files, page, pathname) {
  const directory = path.posix.dirname(page);
  const base = pathname.startsWith('/') || directory === '.' ? '' : directory + '/';
  const normalized = path.posix.normalize((base + pathname).replace(/\0/g, ''));
  const resolvedPath = normalized === '.' ? '' : normalized;
  const relative = resolvedPath.replace(/^\/+/, '');
  let candidates;
  if (!relative || resolvedPath.endsWith('/')) {
    candidates = [relative + 'index.html'];
  } else {
    const name = path.posix.basename(relative);
    candidates = name.includes('.') && !name.startsWith('.')
      ? [relative]
      : [relative + '.html', relative + '/index.html'];
  }
  return { resolvedPath, file: candidates.find(candidate => files.has(candidate)) ?? null };
}

module.exports = { indexDocsFiles, isSkippableUrl, resolveLinkTarget, stripQueryAndHash };
