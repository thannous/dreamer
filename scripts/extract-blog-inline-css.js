#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Extracts duplicated inline <style> blocks from blog pages in `docs/` into
 * a cacheable stylesheet: `docs/css/blog.min.css`.
 *
 * Also:
 * - Removes the matching inline <style> blocks from blog pages
 * - Adds `<link rel="stylesheet" href="/css/blog.min.css?v=...">`
 * - Adds a scoping class on `<html>`: `blog-index` or `blog-article`
 *
 * Usage:
 *   node scripts/extract-blog-inline-css.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const VERSION_PATH = path.join(DOCS_DIR, 'version.txt');
const BLOG_CSS_PATH = path.join(DOCS_DIR, 'css', 'blog.min.css');

const SUPPORTED_LANGS = ['en', 'fr', 'es'];
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function normalizeCss(css) {
  return css.trim().replace(/\s+/g, ' ');
}

function minifyCss(css) {
  // Basic minifier: safe enough for our simple, non-nested inline CSS blocks.
  let out = String(css);
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/\s*([{}:;,])\s*/g, '$1');
  out = out.replace(/;}/g, '}');
  out = out.trim();
  return out ? `${out}\n` : '';
}

function readVersion() {
  if (!fs.existsSync(VERSION_PATH)) return null;
  const version = fs.readFileSync(VERSION_PATH, 'utf8').trim();
  return version || null;
}

function findBlogHtmlFiles() {
  const out = [];
  for (const lang of SUPPORTED_LANGS) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.html')) continue;
      const isIndex = entry === 'index.html';
      out.push({
        lang,
        isIndex,
        absPath: path.join(dir, entry),
        relPath: path.join('docs', lang, 'blog', entry),
      });
    }
  }
  return out.sort((a, b) => a.absPath.localeCompare(b.absPath));
}

function extractHead(html) {
  const match = html.match(/^([\s\S]*?<head\b[^>]*>)([\s\S]*?)(<\/head>[\s\S]*)$/i);
  if (!match) return null;
  return { beforeHead: match[1], head: match[2], afterHead: match[3] };
}

function listStyleBlocksFromHead(head) {
  const blocks = [];
  const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(head))) {
    blocks.push({
      fullMatch: match[0],
      css: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return blocks;
}

function isBlogInlineCss(css) {
  const needle = String(css);
  return (
    needle.includes('.aurora-bg') ||
    needle.includes('::-webkit-scrollbar') ||
    needle.includes('.glass-panel') ||
    needle.includes('.prose h2') ||
    needle.includes('@keyframes aurora')
  );
}

function chooseMostCommonCss(blocks) {
  const counts = new Map();
  for (const css of blocks) {
    const key = normalizeCss(css);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = null;
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  if (!bestKey) return null;
  // Return a representative original block (not normalized) for readability before minify.
  return blocks.find((css) => normalizeCss(css) === bestKey) || null;
}

function prefixIndexCss(css) {
  // Prefix normal rules with `.blog-index` to avoid leaking styles into other pages.
  // Keep keyframes untouched.
  const input = String(css);
  let i = 0;
  let out = '';

  function skipWhitespace() {
    while (i < input.length && /\s/.test(input[i])) i += 1;
  }

  function readUntil(char) {
    const start = i;
    while (i < input.length && input[i] !== char) i += 1;
    return input.slice(start, i);
  }

  function readBlockWithBraces() {
    // Assumes current char is '{'
    let depth = 0;
    const start = i;
    while (i < input.length) {
      const ch = input[i];
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          return input.slice(start, i);
        }
      }
      i += 1;
    }
    return input.slice(start);
  }

  while (i < input.length) {
    skipWhitespace();
    if (i >= input.length) break;

    if (input.slice(i).startsWith('@keyframes') || input.slice(i).startsWith('@-webkit-keyframes')) {
      const selector = readUntil('{');
      if (i < input.length && input[i] === '{') {
        const block = readBlockWithBraces();
        out += `${selector.trim()}${block}\n`;
      } else {
        out += selector;
      }
      continue;
    }

    const selectorRaw = readUntil('{');
    if (i >= input.length) {
      out += selectorRaw;
      break;
    }
    i += 1; // skip '{'

    const bodyStart = i;
    while (i < input.length && input[i] !== '}') i += 1;
    const body = input.slice(bodyStart, i);
    if (i < input.length && input[i] === '}') i += 1;

    const selector = selectorRaw.trim();
    const shouldSkipPrefix =
      selector.length === 0 ||
      selector.startsWith('@') ||
      selector.includes('::-webkit-scrollbar') ||
      selector.startsWith('::') ||
      selector.startsWith('html') ||
      selector.startsWith('body') ||
      selector.startsWith(':root');

    if (shouldSkipPrefix) {
      out += `${selector}{${body}}`;
      continue;
    }

    const prefixedSelector = selector
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `.blog-index ${part}`)
      .join(', ');

    out += `${prefixedSelector}{${body}}`;
  }

  return out.trim() ? `${out.trim()}\n` : '';
}

function upsertHtmlClass(html, className) {
  const htmlTagMatch = html.match(/<html\b[^>]*>/i);
  if (!htmlTagMatch) return html;
  const htmlTag = htmlTagMatch[0];
  const classAttrMatch = htmlTag.match(/\bclass=(["'])([^"']*)\1/i);

  if (classAttrMatch) {
    const quote = classAttrMatch[1];
    const classes = classAttrMatch[2].split(/\s+/).filter(Boolean);
    if (classes.includes(className)) return html;
    const next = classes.concat([className]).join(' ');
    const replaced = htmlTag.replace(classAttrMatch[0], `class=${quote}${next}${quote}`);
    return html.replace(htmlTag, replaced);
  }

  const replaced = htmlTag.replace(/>$/, ` class="${className}">`);
  return html.replace(htmlTag, replaced);
}

function ensureBlogCssLinkInHead(head, version) {
  if (/href=["']\/css\/blog\.min\.css/i.test(head)) return { head, changed: false };
  const v = version ? `?v=${version}` : '';
  const linkLine = `    <!-- Blog CSS -->\n    <link rel="stylesheet" href="/css/blog.min.css${v}">`;

  // Prefer inserting after the main stylesheets.
  const anchor = /(^\s*<link\s+rel=(["'])stylesheet\2\s+href=(["'])\/css\/language-dropdown\.css[^>]*>\s*$)/im;
  if (anchor.test(head)) {
    return { head: head.replace(anchor, (line) => `${line}\n${linkLine}`), changed: true };
  }
  const stylesMin = /(^\s*<link\s+rel=(["'])stylesheet\2\s+href=(["'])\/css\/styles\.min\.css[^>]*>\s*$)/im;
  if (stylesMin.test(head)) {
    return { head: head.replace(stylesMin, (line) => `${line}\n${linkLine}`), changed: true };
  }
  if (/<\/head>/i.test(head)) {
    return { head: head.replace(/<\/head>/i, `${linkLine}\n</head>`), changed: true };
  }
  return { head: `${head}\n${linkLine}\n`, changed: true };
}

function removeInlineBlogStyleBlocksFromHead(head) {
  const blocks = listStyleBlocksFromHead(head);
  const toRemove = blocks.filter((b) => isBlogInlineCss(b.css));
  if (toRemove.length === 0) return { head, removed: 0 };
  let next = head;
  for (const block of toRemove) next = next.replace(block.fullMatch, '');
  // Clean up excessive blank lines left behind.
  next = next.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  return { head: next, removed: toRemove.length };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  const version = readVersion();
  const files = findBlogHtmlFiles();

  const articleCssCandidates = [];
  const indexCssCandidates = [];

  for (const file of files) {
    const raw = fs.readFileSync(file.absPath, 'utf8');
    const parts = extractHead(raw);
    if (!parts) continue;
    const blocks = listStyleBlocksFromHead(parts.head).filter((b) => isBlogInlineCss(b.css));
    if (blocks.length === 0) continue;

    for (const block of blocks) {
      if (file.isIndex) indexCssCandidates.push(block.css);
      else articleCssCandidates.push(block.css);
    }
  }

  const articleCss = chooseMostCommonCss(articleCssCandidates);
  const indexCss = chooseMostCommonCss(indexCssCandidates);

  if (!articleCss) {
    console.error('Could not find inline blog CSS blocks in articles.');
    process.exit(1);
  }
  if (!indexCss) {
    console.error('Could not find inline blog CSS blocks in blog index pages.');
    process.exit(1);
  }

  const minArticle = minifyCss(articleCss);
  const minIndexPrefixed = minifyCss(prefixIndexCss(indexCss));

  const generated =
    `/* blog.min.css (generated) */\n` +
    `/* Do not edit by hand: run scripts/extract-blog-inline-css.js */\n` +
    minArticle +
    `\n/* Blog index overrides (scoped) */\n` +
    minIndexPrefixed;

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(BLOG_CSS_PATH), { recursive: true });
    fs.writeFileSync(BLOG_CSS_PATH, generated, 'utf8');
  }

  let updated = 0;
  let removedStyles = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file.absPath, 'utf8');
    const parts = extractHead(raw);
    if (!parts) continue;

    let nextHead = parts.head;
    const res = removeInlineBlogStyleBlocksFromHead(nextHead);
    nextHead = res.head;
    removedStyles += res.removed;

    const linkRes = ensureBlogCssLinkInHead(nextHead, version);
    nextHead = linkRes.head;

    let next = `${parts.beforeHead}${nextHead}${parts.afterHead}`;
    const className = file.isIndex ? 'blog-index' : 'blog-article';
    next = upsertHtmlClass(next, className);

    if (next !== raw) {
      updated += 1;
      if (!DRY_RUN) fs.writeFileSync(file.absPath, next, 'utf8');
    }
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(
    `[extract-blog-inline-css] mode=${mode} updatedFiles=${updated} removedStyleBlocks=${removedStyles} output=docs/css/blog.min.css`,
  );
}

main();

