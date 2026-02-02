#!/usr/bin/env node
/**
 * Insert visible FAQ blocks from existing JSON-LD FAQPage schema.
 *
 * Fixes `check-site.js` warnings: faq-schema-question-not-visible
 *
 * Usage:
 *   node scripts/insert-visible-faq.js
 *   node scripts/insert-visible-faq.js --lang=en,fr
 *   node scripts/insert-visible-faq.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2).reduce((acc, raw) => {
  const arg = raw.startsWith('--') ? raw.slice(2) : raw;
  const [key, value] = arg.split('=');
  acc[key] = value === undefined ? true : value;
  return acc;
}, {});

const DRY_RUN = !!args['dry-run'];
const LANG_FILTER = args.lang ? args.lang.toString().split(',').map((s) => s.trim()).filter(Boolean) : null;

function decodeEntities(str) {
  if (!str) return '';
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'"
  };
  let out = String(str);
  for (const [k, v] of Object.entries(named)) out = out.split(k).join(v);
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return out;
}

function visibleTextFromHtml(html) {
  let out = String(html || '');
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  out = out.replace(/<!--[\s\S]*?-->/g, ' ');
  out = out.replace(/<[^>]+>/g, ' ');
  out = decodeEntities(out);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function normalizeForSearch(str) {
  return decodeEntities(String(str || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function walkHtmlFiles(rootAbs) {
  const out = [];
  const stack = [rootAbs];
  const ignoreDirNames = new Set([
    'templates',
    'reports',
    '.agent',
    '.agents',
    '.claude',
    '.codex',
    '.gemini',
    '.github',
    '.windsurf'
  ]);
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.DS_Store') continue;
      if (ent.isDirectory() && ignoreDirNames.has(ent.name)) continue;
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.isFile() && abs.endsWith('.html')) out.push(abs);
    }
  }
  return out;
}

function extractHtmlLang(html) {
  const m = html.match(/<html\s+[^>]*lang=["']([^"']+)["'][^>]*>/i);
  return m ? m[1] : null;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractJsonLdObjects(html) {
  const out = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed) out.push(parsed);
    } catch {
      // ignore invalid
    }
  }
  return out;
}

function flattenJsonLd(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.flatMap(flattenJsonLd);
  if (typeof obj !== 'object') return [];
  if (Array.isArray(obj['@graph'])) return obj['@graph'].flatMap(flattenJsonLd);
  return [obj];
}

function isFaqPageObject(o) {
  const t = o?.['@type'];
  if (!t) return false;
  if (Array.isArray(t)) return t.map((x) => String(x)).includes('FAQPage');
  return String(t) === 'FAQPage';
}

function extractFaqItems(html) {
  const jsonLdBlocks = extractJsonLdObjects(html).flatMap(flattenJsonLd);
  const faqPages = jsonLdBlocks.filter(isFaqPageObject);
  if (!faqPages.length) return [];

  const items = [];
  for (const faq of faqPages) {
    const entities = Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
    for (const q of entities) {
      const name = q?.name ? String(q.name).trim() : null;
      const answerText = q?.acceptedAnswer?.text ? String(q.acceptedAnswer.text).trim() : null;
      if (!name || !answerText) continue;
      items.push({ question: name, answer: answerText });
    }
  }

  // De-dupe by question string
  const seen = new Set();
  return items.filter((it) => {
    const key = it.question;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFaqSectionHtml(lang, faqItems) {
  const labels = {
    en: { title: 'FAQ' },
    fr: { title: 'FAQ' },
    es: { title: 'Preguntas frecuentes' },
    de: { title: 'FAQ' },
    it: { title: 'FAQ' }
  };
  const title = (labels[lang] || labels.en).title;

  const cards = faqItems
    .map(
      (it) => `
                <div class="glass-panel rounded-2xl p-6 border border-transparent">
                    <h3 class="font-medium text-dream-cream mb-2">${escapeHtml(it.question)}</h3>
                    <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(it.answer)}</p>
                </div>`
    )
    .join('\n');

  return `
            <!-- FAQ (from JSON-LD) -->
            <section class="mb-10" data-faq-visible="true">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="help-circle" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(title)}
                </h2>
                <div class="grid gap-4">
${cards}
                </div>
            </section>
`;
}

function findInsertIndex(html) {
  // Prefer inserting before sources section when present
  const sourcesIdx = html.search(/<section\b[^>]*id=["']sources["'][^>]*>/i);
  if (sourcesIdx !== -1) return sourcesIdx;

  // Insert before end of article when present
  const articleCloseIdx = html.lastIndexOf('</article>');
  if (articleCloseIdx !== -1) return articleCloseIdx;

  // Insert before end of main
  const mainCloseIdx = html.lastIndexOf('</main>');
  if (mainCloseIdx !== -1) return mainCloseIdx;

  // Fallback: before body end
  const bodyCloseIdx = html.lastIndexOf('</body>');
  if (bodyCloseIdx !== -1) return bodyCloseIdx;

  return html.length;
}

function alreadyHasVisibleFaqMarker(html) {
  return /data-faq-visible=["']true["']/.test(html);
}

function main() {
  const files = walkHtmlFiles(DOCS_ROOT);
  let changed = 0;
  let scanned = 0;

  for (const abs of files) {
    const rel = path.relative(DOCS_ROOT, abs).replace(/\\/g, '/');
    const topDir = rel.split('/')[0];
    if (LANG_FILTER && topDir && !LANG_FILTER.includes(topDir)) continue;

    const html = fs.readFileSync(abs, 'utf8');
    scanned += 1;

    const faqItems = extractFaqItems(html);
    if (!faqItems.length) continue;

    const visibleNorm = normalizeForSearch(visibleTextFromHtml(html));
    const missing = faqItems.filter((it) => {
      const qNorm = normalizeForSearch(it.question);
      return qNorm && !visibleNorm.includes(qNorm);
    });
    if (!missing.length) continue;

    // Avoid duplicating if already inserted once
    if (alreadyHasVisibleFaqMarker(html)) continue;

    const lang = extractHtmlLang(html) || topDir || 'en';
    const section = buildFaqSectionHtml(lang, missing);
    const insertAt = findInsertIndex(html);

    const next = html.slice(0, insertAt) + section + html.slice(insertAt);

    if (!DRY_RUN) fs.writeFileSync(abs, next, 'utf8');
    changed += 1;
  }

  console.log(`${DRY_RUN ? 'Dry-run' : 'Inserted'} visible FAQ sections`);
  console.log(`- Scanned: ${scanned}`);
  console.log(`- Changed: ${changed}`);
}

main();

