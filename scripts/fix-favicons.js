const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const EXCLUDED_DIRS = ['node_modules', '.git'];

function hasFaviconIco(content) {
  return /<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>/i.test(content);
}

function hasFaviconPng(content) {
  return /<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>/i.test(content);
}

function ensureFaviconIco(content) {
  if (hasFaviconIco(content)) return { content, changed: false };

  const firstIconLink = content.match(/(^[ \t]*<link\s+[^>]*rel=["']icon["'][^>]*>\s*$)/im);
  const indentMatch = firstIconLink?.[1]?.match(/^[ \t]*/);
  const indent = indentMatch ? indentMatch[0] : '    ';

  const icoLine = `${indent}<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="any">\n`;

  if (firstIconLink) {
    return { content: content.replace(firstIconLink[1], icoLine + firstIconLink[1]), changed: true };
  }

  // Fallback: insert before </head>
  if (/<\/head>/i.test(content)) {
    return { content: content.replace(/<\/head>/i, `${icoLine}</head>`), changed: true };
  }

  return { content, changed: false };
}

function ensureFaviconPng(content) {
  if (hasFaviconPng(content)) return { content, changed: false };

  const icoLineMatch = content.match(
    /(^[ \t]*<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>\s*$)/im
  );
  const firstIconLink = content.match(/(^[ \t]*<link\s+[^>]*rel=["']icon["'][^>]*>\s*$)/im);
  const indentMatch = (icoLineMatch?.[1] || firstIconLink?.[1])?.match(/^[ \t]*/);
  const indent = indentMatch ? indentMatch[0] : '    ';

  const pngLine = `${indent}<link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">\n`;

  if (icoLineMatch) {
    return { content: content.replace(icoLineMatch[1], `${icoLineMatch[1]}\n${pngLine.trimEnd()}`), changed: true };
  }

  if (firstIconLink) {
    return { content: content.replace(firstIconLink[1], pngLine + firstIconLink[1]), changed: true };
  }

  // Fallback: insert before </head>
  if (/<\/head>/i.test(content)) {
    return { content: content.replace(/<\/head>/i, `${pngLine}</head>`), changed: true };
  }

  return { content, changed: false };
}

function upsertSizesAttribute(tag, sizesValue) {
  if (/\ssizes=/.test(tag)) return tag;
  return tag.replace(/\s*(\/?>)\s*$/, (_match, close) => ` sizes="${sizesValue}"${close}`);
}

function normalizeIconLines(content) {
  let changed = false;
  let out = content;

  // Google Search requires favicons to be a multiple of 48px (e.g. 192x192).
  // Replace the 512x512 marketing logo favicon with our compliant favicon.png.
  out = out.replace(
    /(^[ \t]*)(<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/logo\/logo_noctalia\.png["'][^>]*>\s*$)/gim,
    (_match, indent) => {
      changed = true;
      return `${indent}<link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">`;
    }
  );

  out = out.replace(
    /(^[ \t]*)(<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*href=["']\/logo\/logo_noctalia\.png["'][^>]*>\s*$)/gim,
    (_match, indent) => {
      changed = true;
      return `${indent}<link rel="apple-touch-icon" href="/favicon.png" sizes="192x192">`;
    }
  );

  out = out.replace(
    /(^[ \t]*<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*href=["']\/logo192\.png["'][^>]*>\s*$)/gim,
    (match) => {
      const updated = upsertSizesAttribute(match, '192x192');
      if (updated !== match) changed = true;
      return updated;
    }
  );

  out = out.replace(
    /(^[ \t]*<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>\s*$)/gim,
    (match) => {
      const updated = upsertSizesAttribute(match, '192x192');
      if (updated !== match) changed = true;
      return updated;
    }
  );

  out = out.replace(
    /(^[ \t]*<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*href=["']\/favicon\.png["'][^>]*>\s*$)/gim,
    (match) => {
      const updated = upsertSizesAttribute(match, '192x192');
      if (updated !== match) changed = true;
      return updated;
    }
  );

  // Dedupe duplicated favicon.png lines (can happen after migrations).
  const faviconPngLineRegex = /^[ \t]*<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>\s*$/i;
  const lines = out.split('\n');
  let seenFaviconPngLine = false;
  const dedupedLines = lines.filter((line) => {
    if (!faviconPngLineRegex.test(line)) return true;
    if (seenFaviconPngLine) {
      changed = true;
      return false;
    }
    seenFaviconPngLine = true;
    return true;
  });
  out = dedupedLines.join('\n');

  return { content: out, changed };
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  let content = original;
  let changed = false;

  const icoResult = ensureFaviconIco(content);
  content = icoResult.content;
  changed ||= icoResult.changed;

  const normalizeResult = normalizeIconLines(content);
  content = normalizeResult.content;
  changed ||= normalizeResult.changed;

  const pngResult = ensureFaviconPng(content);
  content = pngResult.content;
  changed ||= pngResult.changed;

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walk(dir) {
  const entries = fs.readdirSync(dir);
  let updated = 0;
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry)) updated += walk(fullPath);
      continue;
    }
    if (entry.endsWith('.html') && processFile(fullPath)) updated += 1;
  }
  return updated;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Missing docs directory: ${DOCS_DIR}`);
    process.exitCode = 1;
    return;
  }

  console.log('Fixing favicons in docs/*.html ...');
  const updated = walk(DOCS_DIR);
  console.log(`Done. Updated ${updated} files.`);
}

main();
