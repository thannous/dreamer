#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const {
  normalizePrettyPath,
  readJson,
  readSourceDocument,
  walkFiles,
  writeSourceDocument,
} = require('./lib/docs-source-utils');

const ROOT_DIR = path.join(__dirname, '..');
const DOCS_SRC_DIR = path.join(ROOT_DIR, 'docs-src');
const AHREFS_DIR = path.join(ROOT_DIR, 'marketing', 'seo', 'ahrefs', 'site-audit-2026-05-15');
const SITE_MANIFEST_PATH = path.join(ROOT_DIR, 'data', 'site-manifest.json');
const DOMAIN = 'https://noctalia.app';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes && char === '"' && next === '"') {
      field += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index++;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  const [headers = [], ...bodyRows] = rows;
  return bodyRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ''), values[index] ?? '']))
  );
}

function readAuditCsv(fileName) {
  return parseCsv(fs.readFileSync(path.join(AHREFS_DIR, fileName), 'utf8'));
}

function decodeHtml(value) {
  const named = {
    amp: '&',
    apos: "'",
    eacute: 'é',
    egrave: 'è',
    ecirc: 'ê',
    Eacute: 'É',
    agrave: 'à',
    aacute: 'á',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ntilde: 'ñ',
    ouml: 'ö',
    auml: 'ä',
    uuml: 'ü',
    quot: '"',
  };

  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return named[entity] || match;
  });
}

function stripBrand(title) {
  return decodeHtml(title).replace(/\s*[|-]\s*Noctalia\s*$/i, '').trim();
}

function normalizeTitle(title) {
  return `${title.trim()} | Noctalia`;
}

function shortenTitle(rawTitle) {
  const base = stripBrand(rawTitle)
    .replace(/\s+/g, ' ')
    .replace(/N°1/g, 'n°1')
    .trim();

  const exact = new Map([
    ['Soñar que vuelas: significado de volar alto, bajo o con miedo', 'Soñar que vuelas: significado'],
    ['Meilleures applications de journal de reves et alternatives a Noctalia', 'Applications de journal de rêves et alternatives'],
    ['Controlling Your Dreams to Solve Problems: The Study That Changes Everything', 'Controlling Dreams to Solve Problems'],
    ['Daylight Saving Time and Sleep: How the Clock Change Disrupts Your Dreams', 'Daylight Saving Time and Sleep'],
    ['Sleep Debt: How Chronic Sleep Deprivation Affects Your Health and Dreams', 'Sleep Debt and Health'],
    ['Sleep Is Your #1 Health Lever: The OHSU Study That Changes Everything', 'Sleep Is Your #1 Health Lever'],
    ['Spring Sleep Disruption: How Longer Days Alter Your Sleep and Dreams', 'Spring Sleep Disruption and Dreams'],
    ['Schlaf als Gesundheitsfaktor Nr. 1: Die OHSU-Studie, die alles verändert', 'Schlaf als Gesundheitsfaktor Nr. 1'],
    ['Träume steuern zur Problemlösung: Die Studie, die alles verändert', 'Träume steuern zur Problemlösung'],
    ['Traqueurs de sommeil connectés et rêves : ce qu\'ils mesurent vs ce qu\'ils manquent', 'Traqueurs de sommeil connectés et rêves'],
    ['Rastreadores de sueño wearables y sueños: qué miden y qué se les escapa', 'Rastreadores de sueño wearables y sueños'],
  ]);

  if (exact.has(base)) return normalizeTitle(exact.get(base));

  let next = base
    .replace(/: The Study That Changes Everything$/i, '')
    .replace(/: l'étude qui change tout$/i, '')
    .replace(/: el estudio que lo cambia todo$/i, '')
    .replace(/: lo studio che cambia tutto$/i, '')
    .replace(/: Die Studie, die alles verändert$/i, '')
    .replace(/: Die Studie, die alles veraendert$/i, '')
    .replace(/: ce qu'ils mesurent vs ce qu'ils manquent$/i, '')
    .replace(/: qué miden y qué se les escapa$/i, '')
    .replace(/: qu&eacute; miden y qu&eacute; se les escapa$/i, '');

  if (normalizeTitle(next).length > 68 && next.includes(':')) {
    const [before, after] = next.split(/:\s+/, 2);
    const firstWords = (after || '').split(/\s+/).slice(0, 3).join(' ');
    next = before.length >= 36 || !firstWords ? before : `${before}: ${firstWords}`;
  }

  if (normalizeTitle(next).length > 68) {
    const maxBaseLength = 57;
    const cut = next.slice(0, maxBaseLength + 1);
    next = cut.slice(0, Math.max(cut.lastIndexOf(' '), 42)).replace(/[,:;.-]\s*$/, '');
  }

  return normalizeTitle(next);
}

function shortenDescription(value) {
  const decoded = decodeHtml(value).replace(/\s+/g, ' ').trim();
  if (decoded.length <= 158) return decoded;

  const firstSentence = decoded.match(/^(.+?[.!?])\s/);
  if (firstSentence && firstSentence[1].length >= 70 && firstSentence[1].length <= 158) {
    return firstSentence[1];
  }

  const hardLimit = 155;
  const cut = decoded.slice(0, hardLimit + 1);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(';'), cut.lastIndexOf(','), cut.lastIndexOf(' '));
  const trimmed = cut.slice(0, Math.max(end, 120)).replace(/[,:;.-]\s*$/, '').trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sourceIndex() {
  const manifest = readJson(SITE_MANIFEST_PATH);
  const index = new Map();

  for (const [collectionName, collection] of Object.entries(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      for (const [lang, locale] of Object.entries(entry.locales || {})) {
        let sourcePath = null;
        if (collectionName === 'blog') {
          sourcePath = path.join(DOCS_SRC_DIR, 'content', 'blog', entry.id, `${lang}.md`);
        } else if (collectionName === 'pages') {
          sourcePath = path.join(DOCS_SRC_DIR, 'content', 'pages', entry.id, `${lang}.md`);
        }
        if (sourcePath && fs.existsSync(sourcePath)) {
          index.set(normalizePrettyPath(locale.path), sourcePath);
        }
      }
    }
  }

  return index;
}

function pathFromUrl(url) {
  return normalizePrettyPath(new URL(url).pathname);
}

function updateJsonLdStrings(meta, updater) {
  if (!Array.isArray(meta.jsonLd)) return;
  meta.jsonLd = meta.jsonLd.map((raw) => {
    try {
      const parsed = JSON.parse(raw);
      const next = updater(parsed);
      return JSON.stringify(next, null, 4);
    } catch {
      return raw;
    }
  });
}

function updateSeoFields(filePath, changes) {
  const { meta, body } = readSourceDocument(filePath);
  const oldTitle = meta.title;
  const oldDescription = meta.description;

  if (changes.title) {
    meta.title = changes.title;
    if (!meta.ogTitle || meta.ogTitle === oldTitle) meta.ogTitle = changes.title;
    if (!meta.twitterTitle || meta.twitterTitle === oldTitle) meta.twitterTitle = changes.title;
  }

  if (changes.description) {
    meta.description = changes.description;
    if (!meta.ogDescription || meta.ogDescription === oldDescription) meta.ogDescription = changes.description;
    if (!meta.twitterDescription || meta.twitterDescription === oldDescription) {
      meta.twitterDescription = changes.description;
    }
  }

  updateJsonLdStrings(meta, (node) => {
    const updateNode = (entry) => {
      if (changes.title && entry.name === oldTitle) entry.name = changes.title;
      if (changes.description && entry.description === oldDescription) entry.description = changes.description;
      if (Array.isArray(entry['@graph'])) entry['@graph'].forEach(updateNode);
      return entry;
    };
    return updateNode(node);
  });

  writeSourceDocument(filePath, meta, body);
}

function fixEnglishHomeRedirectLinks() {
  let files = 0;
  let replacements = 0;
  const sourceFiles = walkFiles(path.join(DOCS_SRC_DIR, 'content'), (filePath) => filePath.endsWith('.md'));

  for (const filePath of sourceFiles) {
    const raw = fs.readFileSync(filePath, 'utf8');
    let next = raw
      .replace(/href="\/en\/"/g, 'href="/"')
      .replace(/href='\/en\/'/g, "href='/'")
      .replace(/https:\/\/noctalia\.app\/en\/(?=(?:\\")|["'<\s,)}\]])/g, 'https://noctalia.app/');

    if (next !== raw) {
      files++;
      replacements += (raw.match(/href=["']\/en\/["']|https:\/\/noctalia\.app\/en\/(?=(?:\\")|["'<\s,)}\]])/g) || []).length;
      fs.writeFileSync(filePath, next, 'utf8');
    }
  }

  return { files, replacements };
}

function applyAuditMetadata() {
  const index = sourceIndex();
  const updates = new Map();

  for (const row of readAuditCsv('title-too-long.csv')) {
    const sourcePath = index.get(pathFromUrl(row.URL));
    if (!sourcePath) continue;
    updates.set(sourcePath, {
      ...(updates.get(sourcePath) || {}),
      title: shortenTitle(row.Title),
    });
  }

  for (const row of readAuditCsv('meta-description-too-long.csv')) {
    const sourcePath = index.get(pathFromUrl(row.URL));
    if (!sourcePath) continue;
    updates.set(sourcePath, {
      ...(updates.get(sourcePath) || {}),
      description: shortenDescription(row['Meta description']),
    });
  }

  for (const [filePath, changes] of updates.entries()) {
    updateSeoFields(filePath, changes);
  }

  return { files: updates.size };
}

function applyPriorityInternalLinks() {
  const changes = [];
  const targets = [
    {
      file: path.join(DOCS_SRC_DIR, 'content', 'blog', 'blog.why-we-dream-science', 'es.md'),
      from: 'como la parálisis del sueño)</li>',
      to: 'como la <a class="text-dream-salmon hover:underline" href="guia-paralisis-sueno">parálisis del sueño</a>)</li>',
    },
    {
      file: path.join(DOCS_SRC_DIR, 'content', 'blog', 'blog.rem-sleep-dreams', 'es.md'),
      from: '<li><strong>Parálisis del sueño:</strong> Episodios frecuentes de parálisis REM al despertar o dormirse</li>',
      to: '<li><strong><a class="text-dream-salmon hover:underline" href="guia-paralisis-sueno">Parálisis del sueño</a>:</strong> Episodios frecuentes de parálisis REM al despertar o dormirse</li>',
    },
  ];

  for (const target of targets) {
    const raw = fs.readFileSync(target.file, 'utf8');
    if (raw.includes(target.to) || !raw.includes(target.from)) continue;
    fs.writeFileSync(target.file, raw.replace(target.from, target.to), 'utf8');
    changes.push(path.relative(ROOT_DIR, target.file));
  }

  return { files: changes };
}

function fixPressSchema() {
  const filePath = path.join(DOCS_SRC_DIR, 'content', 'pages', 'page.press', 'en.md');
  const { meta, body } = readSourceDocument(filePath);
  meta.jsonLd = [
    JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': `${DOMAIN}/en/press#webpage`,
            name: 'Noctalia Press Kit',
            description: meta.description,
            url: `${DOMAIN}/en/press`,
            inLanguage: 'en',
            about: { '@id': `${DOMAIN}/#software` },
            publisher: { '@id': `${DOMAIN}/#organization` },
          },
          {
            '@type': 'Organization',
            '@id': `${DOMAIN}/#organization`,
            name: 'Noctalia',
            url: DOMAIN,
            logo: {
              '@type': 'ImageObject',
              url: `${DOMAIN}/logo/logo_noctalia.png`,
            },
            founder: {
              '@type': 'Person',
              name: 'Thanh Chau',
              url: `${DOMAIN}/en/about#person`,
            },
            email: 'contact@noctalia.app',
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${DOMAIN}/#software`,
            name: 'Noctalia',
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'Android',
            url: DOMAIN,
            downloadUrl: 'https://play.google.com/store/apps/details?id=com.tanuki75.noctalia',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
            },
          },
        ],
      },
      null,
      4
    ),
    JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Press kit', item: `${DOMAIN}/en/press` },
        ],
      },
      null,
      4
    ),
  ];
  writeSourceDocument(filePath, meta, body);
  return { file: path.relative(ROOT_DIR, filePath) };
}

function main() {
  const linkFix = fixEnglishHomeRedirectLinks();
  const metadataFix = applyAuditMetadata();
  const internalLinks = applyPriorityInternalLinks();
  const pressSchema = fixPressSchema();

  console.log(`[ahrefs-fix] English home redirect link files: ${linkFix.files}, replacements: ${linkFix.replacements}`);
  console.log(`[ahrefs-fix] Metadata files updated: ${metadataFix.files}`);
  console.log(`[ahrefs-fix] Priority internal links updated: ${internalLinks.files.length}`);
  console.log(`[ahrefs-fix] Press schema updated: ${pressSchema.file}`);
}

main();
