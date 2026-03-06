const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function walkFiles(dirPath, predicate = null) {
  if (!fs.existsSync(dirPath)) return [];

  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (predicate && !predicate(entryPath)) continue;
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function parseSourceDocument(raw, filePath = '<inline>') {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid source document front matter in ${filePath}`);
  }

  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid JSON front matter in ${filePath}: ${error.message}`);
  }

  return {
    meta,
    body: match[2],
  };
}

function readSourceDocument(filePath) {
  return parseSourceDocument(fs.readFileSync(filePath, 'utf8'), filePath);
}

function writeSourceDocument(filePath, meta, body) {
  ensureDir(path.dirname(filePath));
  const payload = `---\n${JSON.stringify(meta, null, 2)}\n---\n${body}`;
  fs.writeFileSync(filePath, payload, 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;

  const files = walkFiles(sourceDir);
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath);
    copyFile(filePath, path.join(targetDir, relativePath));
  }
}

function normalizePrettyPath(urlPath) {
  let next = String(urlPath || '')
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');

  if (!next.startsWith('/')) next = `/${next}`;
  if (next === '/index') next = '/';

  return next;
}

module.exports = {
  copyDir,
  copyFile,
  ensureDir,
  escapeHtml,
  normalizePrettyPath,
  parseSourceDocument,
  readJson,
  readSourceDocument,
  toPosix,
  walkFiles,
  writeJson,
  writeSourceDocument,
};
