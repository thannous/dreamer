#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Adds a real internal linking block to blog articles:
 * - Prev/Next navigation cards
 * - Related articles cards (category-based from blog index ordering)
 * - <link rel="prev|next"> in <head>
 *
 * Idempotent via HTML comment markers.
 *
 * Usage:
 *   node scripts/add-blog-related-navigation.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DOCS_DIR = path.join(__dirname, '../docs');
const DOMAIN = 'https://noctalia.app';
const SUPPORTED_LANGS = ['en', 'fr', 'es'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const UI = {
  fr: {
    prev: 'Article précédent',
    next: 'Article suivant',
    all: 'Toutes les ressources',
    allDesc: 'Découvrir toutes les ressources',
    navLabel: 'Navigation entre articles',
    relatedTitle: 'À lire ensuite',
    relatedDesc: 'Ressources complémentaires sur le même thème',
    categories: {
      guide: 'Guide',
      science: 'Science',
      interpretation: 'Interprétation',
      reference: 'Référence',
      'reve-lucide': 'Rêve lucide',
    },
  },
  en: {
    prev: 'Previous article',
    next: 'Next article',
    all: 'All resources',
    allDesc: 'Browse all resources',
    navLabel: 'Article navigation',
    relatedTitle: 'Read next',
    relatedDesc: 'More resources on the same topic',
    categories: {
      guide: 'Guide',
      science: 'Science',
      interpretation: 'Interpretation',
      reference: 'Reference',
      'lucid-dreams': 'Lucid dreams',
    },
  },
  es: {
    prev: 'Artículo anterior',
    next: 'Artículo siguiente',
    all: 'Todos los recursos',
    allDesc: 'Ver todos los recursos',
    navLabel: 'Navegación entre artículos',
    relatedTitle: 'Para seguir leyendo',
    relatedDesc: 'Recursos relacionados sobre el mismo tema',
    categories: {
      guia: 'Guía',
      ciencia: 'Ciencia',
      interpretacion: 'Interpretación',
      referencia: 'Referencia',
      'suenos-lucidos': 'Sueños lúcidos',
    },
  },
};

function findBlogArticleFiles(lang) {
  const dir = path.join(DOCS_DIR, lang, 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => name !== 'index.html')
    .map((name) => ({
      lang,
      slug: name.replace(/\.html$/, ''),
      absPath: path.join(dir, name),
      relPath: path.join('docs', lang, 'blog', name),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function getCanonicalUrl(html) {
  const match = html.match(/<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i);
  return match ? match[3] : null;
}

function removePrevNextLinksFromHead(head) {
  let next = head;
  next = next.replace(/^\s*<link\s+rel=(["'])(?:prev|next)\1[^>]*>\s*\n?/gim, '');
  next = next.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  return next;
}

function splitHead(html) {
  const match = html.match(/^([\s\S]*?<head\b[^>]*>)([\s\S]*?)(<\/head>[\s\S]*)$/i);
  if (!match) return null;
  return { beforeHead: match[1], head: match[2], afterHead: match[3] };
}

function insertPrevNextLinks(html, { prevSlug, nextSlug, lang }) {
  const parts = splitHead(html);
  if (!parts) return html;

  const canonicalLine = /^\s*<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2\s*>\s*$/im;
  if (!canonicalLine.test(parts.head)) return html;

  let head = removePrevNextLinksFromHead(parts.head);
  const prevHref = prevSlug ? `${DOMAIN}/${lang}/blog/${prevSlug}` : null;
  const nextHref = nextSlug ? `${DOMAIN}/${lang}/blog/${nextSlug}` : null;

  const indentMatch = head.match(/(^\s*)<link\s+rel=(["'])canonical\2/m);
  const indent = indentMatch ? indentMatch[1] : '    ';

  const lines = [];
  if (prevHref) lines.push(`${indent}<link rel="prev" href="${prevHref}">`);
  if (nextHref) lines.push(`${indent}<link rel="next" href="${nextHref}">`);
  if (lines.length === 0) return html;

  head = head.replace(canonicalLine, (line) => `${line}\n${lines.join('\n')}`);
  return `${parts.beforeHead}${head}${parts.afterHead}`;
}

function parseBlogIndex(lang) {
  const indexPath = path.join(DOCS_DIR, lang, 'blog', 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  const html = fs.readFileSync(indexPath, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const cards = Array.from(document.querySelectorAll('article.article-card'));
  const items = [];

  for (const card of cards) {
    const link = card.querySelector('a[href]');
    const href = (link?.getAttribute('href') || '').trim();
    if (!href) continue;
    if (href.startsWith('/') || href.includes('/') || href.includes('.') || href.startsWith('#')) continue;

    const titleAttr = (card.getAttribute('data-title') || '').trim();
    const title = titleAttr || (card.querySelector('h2')?.textContent || '').replace(/\s+/g, ' ').trim() || href;

    const category = (card.getAttribute('data-category') || '').trim() || null;
    items.push({ slug: href, title, category });
  }

  const bySlug = new Map(items.map((it) => [it.slug, it]));
  return { items, bySlug };
}

function categoryLabel(lang, category) {
  const table = UI[lang]?.categories || {};
  if (category && table[category]) return table[category];
  if (!category) return null;
  return category.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function pickRelated({ items, currentSlug, category, max = 3 }) {
  const out = [];
  const seen = new Set([currentSlug]);

  for (const item of items) {
    if (out.length >= max) break;
    if (seen.has(item.slug)) continue;
    if (category && item.category === category) {
      out.push(item);
      seen.add(item.slug);
    }
  }

  if (out.length < max) {
    for (const item of items) {
      if (out.length >= max) break;
      if (seen.has(item.slug)) continue;
      out.push(item);
      seen.add(item.slug);
    }
  }

  return out.slice(0, max);
}

function detectExistingRelatedSection(html) {
  return (
    /data-blog-related=/.test(html) ||
    /<!--\s*Related Articles\s*-->/.test(html) ||
    /<h2\b[^>]*>\s*(Related Articles|Articles liés|Artículos relacionados|À lire ensuite|Read next|Para seguir leyendo)\s*<\/h2>/i.test(
      html,
    )
  );
}

function buildNavBlock({ lang, prev, next }) {
  const ui = UI[lang];
  const blogIndexHref = `/${lang}/blog/`;

  const left =
    prev
      ? {
          href: prev.slug,
          label: ui.prev,
          title: prev.title,
          icon: 'arrow-left',
        }
      : {
          href: blogIndexHref,
          label: ui.all,
          title: ui.allDesc,
          icon: 'home',
        };

  const right =
    next
      ? {
          href: next.slug,
          label: ui.next,
          title: next.title,
          icon: 'arrow-right',
        }
      : {
          href: blogIndexHref,
          label: ui.all,
          title: ui.allDesc,
          icon: 'home',
        };

  return [
    '<!-- Blog Nav Start -->',
    `<section class="mt-12" aria-label="${ui.navLabel}" data-blog-nav>`,
    '  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
    `    <a href="${left.href}" class="glass-panel rounded-xl p-5 flex items-start gap-3 hover:border-dream-salmon/30 transition-all hover:-translate-y-1">`,
    `      <i data-lucide="${left.icon}" class="w-5 h-5 mt-1 text-dream-salmon shrink-0"></i>`,
    '      <div>',
    `        <span class="text-xs text-purple-300/60 uppercase tracking-wide">${left.label}</span>`,
    `        <div class="font-serif text-lg text-dream-cream mt-1">${left.title}</div>`,
    '      </div>',
    '    </a>',
    `    <a href="${right.href}" class="glass-panel rounded-xl p-5 flex items-start justify-between gap-3 hover:border-dream-salmon/30 transition-all hover:-translate-y-1">`,
    '      <div>',
    `        <span class="text-xs text-purple-300/60 uppercase tracking-wide">${right.label}</span>`,
    `        <div class="font-serif text-lg text-dream-cream mt-1">${right.title}</div>`,
    '      </div>',
    `      <i data-lucide="${right.icon}" class="w-5 h-5 mt-1 text-dream-salmon shrink-0"></i>`,
    '    </a>',
    '  </div>',
    '</section>',
    '<!-- Blog Nav End -->',
  ].join('\n');
}

function buildRelatedBlock({ lang, related }) {
  const ui = UI[lang];
  const cards = related
    .map((item) => {
      const label = categoryLabel(lang, item.category) || '';
      const labelHtml = label
        ? `<span class="text-xs text-dream-salmon uppercase mb-2 block">${label}</span>\n`
        : '';
      return (
        `        <a href="${item.slug}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 transition-all hover:-translate-y-1">\n` +
        `            ${labelHtml}` +
        `            <h3 class="font-serif text-lg text-dream-cream mb-2">${item.title}</h3>\n` +
        `        </a>`
      );
    })
    .join('\n');

  return [
    '<!-- Blog Related Start -->',
    `<section class="mt-12" aria-label="${ui.relatedTitle}" data-blog-related>`,
    '  <header class="mb-6">',
    `    <h2 class="font-serif text-2xl text-dream-cream mb-2">${ui.relatedTitle}</h2>`,
    `    <p class="text-sm text-purple-300/60">${ui.relatedDesc}</p>`,
    '  </header>',
    '  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
    cards,
    '  </div>',
    '</section>',
    '<!-- Blog Related End -->',
  ].join('\n');
}

function indentBlock(blockHtml, indent) {
  return blockHtml
    .split('\n')
    .map((line) => (line.length ? `${indent}${line}` : line))
    .join('\n');
}

function getIndentBefore(html, needle) {
  const idx = html.lastIndexOf(needle);
  if (idx === -1) return '';
  const before = html.slice(0, idx);
  const match = before.match(/\n([ \t]*)$/);
  return match ? match[1] : '';
}

function replaceOrInsertBlock(html, { markerStart, markerEnd, blockHtml, insertBefore }) {
  const indent = getIndentBefore(html, insertBefore);
  const indentedBlock = indentBlock(blockHtml, indent);

  const startIdx = html.indexOf(markerStart);
  const endIdx = html.indexOf(markerEnd);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = html.slice(0, startIdx);
    const after = html.slice(endIdx + markerEnd.length);
    return `${before}${indentedBlock}${after}`;
  }

  const insertIdx = html.lastIndexOf(insertBefore);
  if (insertIdx === -1) return html;
  const before = html.slice(0, insertIdx).replace(/[ \t]*$/, '');
  const after = html.slice(insertIdx);
  return `${before}\n${indentedBlock}\n${after}`;
}

function processArticle({ file, indexData }) {
  const raw = fs.readFileSync(file.absPath, 'utf8');

  // Only process pages that look like blog articles.
  if (!/["@']@type["@']\s*:\s*["']BlogPosting["']/.test(raw)) return { changed: false, reason: 'not-article' };

  const items = indexData.items;
  const idx = items.findIndex((it) => it.slug === file.slug);
  if (idx === -1) return { changed: false, reason: 'slug-not-in-index' };

  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx < items.length - 1 ? items[idx + 1] : null;

  const current = items[idx];
  const related = pickRelated({
    items,
    currentSlug: file.slug,
    category: current.category,
    max: 3,
  });

  let nextHtml = raw;
  const hasRelatedAlready = detectExistingRelatedSection(raw);

  // Head rel=prev/next (absolute)
  nextHtml = insertPrevNextLinks(nextHtml, {
    prevSlug: prev ? prev.slug : null,
    nextSlug: next ? next.slug : null,
    lang: file.lang,
  });

  const navBlock = buildNavBlock({ lang: file.lang, prev, next });
  nextHtml = replaceOrInsertBlock(nextHtml, {
    markerStart: '<!-- Blog Nav Start -->',
    markerEnd: '<!-- Blog Nav End -->',
    blockHtml: navBlock,
    insertBefore: '</article>',
  });

  // Related section: only add if none detected (avoid duplicating handcrafted sections).
  if (!hasRelatedAlready) {
    const relatedBlock = buildRelatedBlock({ lang: file.lang, related });
    nextHtml = replaceOrInsertBlock(nextHtml, {
      markerStart: '<!-- Blog Related Start -->',
      markerEnd: '<!-- Blog Related End -->',
      blockHtml: relatedBlock,
      insertBefore: '</article>',
    });
  }

  // Keep diffs tidy.
  nextHtml = nextHtml.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');

  const changed = nextHtml !== raw;
  if (changed && !DRY_RUN) fs.writeFileSync(file.absPath, nextHtml, 'utf8');
  return { changed, reason: changed ? 'updated' : 'no-op' };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  let updated = 0;
  const skipped = {};

  for (const lang of SUPPORTED_LANGS) {
    const indexData = parseBlogIndex(lang);
    if (!indexData) {
      skipped[`missing-index-${lang}`] = (skipped[`missing-index-${lang}`] || 0) + 1;
      continue;
    }
    const files = findBlogArticleFiles(lang);
    for (const file of files) {
      const res = processArticle({ file, indexData });
      if (res.changed) updated += 1;
      else skipped[res.reason] = (skipped[res.reason] || 0) + 1;
    }
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[add-blog-related-navigation] mode=${mode} updated=${updated}`, skipped);
}

main();
