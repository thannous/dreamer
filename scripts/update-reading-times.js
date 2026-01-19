/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const WPM = 300;

const LOCALES = [
  { code: 'fr', phrase: 'min de lecture' },
  { code: 'en', phrase: 'min read' },
  { code: 'es', phrase: 'min de lectura' },
];

function countWords(text) {
  const matches = text.match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function computeReadingMinutesFromHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const proseEls = Array.from(document.querySelectorAll('.prose'));
  const candidates = proseEls.length > 0 ? proseEls : Array.from(document.querySelectorAll('article'));
  const text = candidates.map((el) => el.textContent || '').join(' ');
  const words = countWords(text);

  if (words === 0) return null;
  const minutes = Math.max(1, Math.ceil(words / WPM));
  return { minutes, words };
}

function replaceFirst(html, regex, replacer) {
  let replaced = false;
  const next = html.replace(regex, (...args) => {
    replaced = true;
    return replacer(...args);
  });
  return { replaced, next };
}

function buildReadingTimeBySlug(blogDir) {
  const entries = fs.readdirSync(blogDir, { withFileTypes: true });
  const result = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (entry.name === 'index.html') continue;

    const slug = entry.name.replace(/\.html$/, '');
    const filePath = path.join(blogDir, entry.name);
    const html = fs.readFileSync(filePath, 'utf8');
    const info = computeReadingMinutesFromHtml(html);
    if (!info) continue;
    result.set(slug, info.minutes);
  }

  return result;
}

function updateArticleFile({ filePath, phrase, minutes, write }) {
  const html = fs.readFileSync(filePath, 'utf8');

  const readingTimeRegex = new RegExp(`>(\\d+)\\s+${phrase}<`);
  if (!readingTimeRegex.test(html)) return { changed: false };

  const { replaced, next } = replaceFirst(html, readingTimeRegex, (match, _oldMinutes) => {
    return `>${minutes} ${phrase}<`;
  });

  if (!replaced || next === html) return { changed: false };
  if (write) fs.writeFileSync(filePath, next, 'utf8');
  return { changed: true };
}

function updateIndexFile({ filePath, phrase, minutesBySlug, write }) {
  const html = fs.readFileSync(filePath, 'utf8');

  const articleBlockRegex = /<article\b[\s\S]*?<\/article>/g;
  let changed = false;

  const next = html.replace(articleBlockRegex, (block) => {
    const hrefMatch = block.match(/<a\s+href="([^"]+)"/);
    if (!hrefMatch) return block;

    const href = hrefMatch[1].split('#')[0].split('?')[0];
    if (!href) return block;
    if (href.includes('/guides/')) return block;
    if (/^https?:\/\//.test(href)) return block;

    const slug = href.split('/').filter(Boolean).pop();
    if (!slug) return block;

    const minutes = minutesBySlug.get(slug);
    if (!minutes) return block;

    let nextBlock = block;

    if (/data-reading-time="\d+"/.test(nextBlock)) {
      nextBlock = nextBlock.replace(/data-reading-time="\d+"/, `data-reading-time="${minutes}"`);
    }

    const spanRegex = new RegExp(`>(\\d+)\\s+${phrase}<`);
    if (spanRegex.test(nextBlock)) {
      nextBlock = nextBlock.replace(spanRegex, `>${minutes} ${phrase}<`);
    }

    if (nextBlock !== block) changed = true;
    return nextBlock;
  });

  if (!changed || next === html) return { changed: false };
  if (write) fs.writeFileSync(filePath, next, 'utf8');
  return { changed: true };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write') || (!args.includes('--check') && !args.includes('--dry-run'));

  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  let totalChanged = 0;
  const perLocaleChanged = {};

  for (const { code, phrase } of LOCALES) {
    const blogDir = path.join(docsDir, code, 'blog');
    const indexPath = path.join(blogDir, 'index.html');
    if (!fs.existsSync(blogDir)) continue;

    const minutesBySlug = buildReadingTimeBySlug(blogDir);

    let localeChanged = 0;

    const entries = fs.readdirSync(blogDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.html')) continue;
      if (entry.name === 'index.html') continue;

      const slug = entry.name.replace(/\.html$/, '');
      const minutes = minutesBySlug.get(slug);
      if (!minutes) continue;

      const res = updateArticleFile({
        filePath: path.join(blogDir, entry.name),
        phrase,
        minutes,
        write,
      });
      if (res.changed) localeChanged += 1;
    }

    if (fs.existsSync(indexPath)) {
      const res = updateIndexFile({ filePath: indexPath, phrase, minutesBySlug, write });
      if (res.changed) localeChanged += 1;
    }

    perLocaleChanged[code] = localeChanged;
    totalChanged += localeChanged;
  }

  const mode = write ? 'write' : 'check';
  console.log(`[update-reading-times] mode=${mode} wpm=${WPM} changed=${totalChanged}`, perLocaleChanged);

  if (!write && totalChanged > 0) process.exit(2);
}

main();
