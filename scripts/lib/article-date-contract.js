'use strict';

const { escapeHtml } = require('./docs-source-utils');

const ARTICLE_SCHEMA_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);
const DATED_PAGE_SCHEMA_TYPES = new Set(['WebPage', 'CollectionPage']);
const EDITORIAL_TIME_ZONE = 'Europe/Paris';
const LEGACY_UPDATED_LABELS = [
  'Last updated',
  'Mis à jour le',
  'Actualizado el',
  'Última actualización',
  'Zuletzt aktualisiert',
  'Ultimo aggiornamento',
  'Aggiornato il',
  "Aggiornato l'",
];

const DATE_LABELS = {
  de: 'Zuletzt aktualisiert',
  en: 'Last updated',
  es: 'Última actualización',
  fr: 'Mis à jour le',
  it: 'Ultimo aggiornamento',
};

const DATE_LOCALES = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
};

function parseContentDate(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day ||
    Number.isNaN(Date.parse(trimmed))
  ) {
    return null;
  }

  return {
    raw: trimmed,
    dateOnly: match[0].slice(0, 10),
    utcDate,
  };
}

function todayDateOnly(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const timeZone = options.timeZone || EDITORIAL_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateArticleDates(meta, options = {}) {
  const errors = [];
  const published = parseContentDate(meta?.publishedTime);
  const modified = parseContentDate(meta?.modifiedTime);
  const today = todayDateOnly(options);

  if (!published) errors.push('publishedTime must be an explicit valid ISO date');
  if (!modified) errors.push('modifiedTime must be an explicit valid ISO date');

  if (published && modified && modified.utcDate < published.utcDate) {
    errors.push('modifiedTime cannot be earlier than publishedTime');
  }
  if (published && published.dateOnly > today) {
    errors.push('publishedTime cannot be in the future');
  }
  if (modified && modified.dateOnly > today) {
    errors.push('modifiedTime cannot be in the future');
  }

  return { errors, published, modified };
}

function validateModifiedTime(value, options = {}) {
  const errors = [];
  const modified = parseContentDate(value);
  const today = todayDateOnly(options);

  if (!modified) {
    errors.push('modifiedTime must be an explicit valid ISO date');
  } else if (modified.dateOnly > today) {
    errors.push('modifiedTime cannot be in the future');
  }

  return { errors, modified };
}

function parseJsonLdBlock(block) {
  if (typeof block === 'string') return JSON.parse(block.trim());
  return JSON.parse(JSON.stringify(block));
}

function findFirstArticleSchema(blocks) {
  let found = null;

  function visit(node) {
    if (found) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (hasSchemaType(node)) {
      found = node;
      return;
    }
    for (const value of Object.values(node)) visit(value);
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    visit(parseJsonLdBlock(block));
    if (found) break;
  }
  return found;
}

function findFirstSchemaByType(blocks, type) {
  let found = null;

  function visit(node) {
    if (found) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const values = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (values.includes(type)) {
      found = node;
      return;
    }
    for (const value of Object.values(node)) visit(value);
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    visit(parseJsonLdBlock(block));
    if (found) break;
  }
  return found;
}

function hasSchemaType(node, expectedTypes = ARTICLE_SCHEMA_TYPES) {
  const values = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
  return values.some((value) => expectedTypes.has(value));
}

function isPersonReviewer(value) {
  if (!value || typeof value !== 'object') return false;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  return types.includes('Person') && typeof value.name === 'string' && value.name.trim() !== '';
}

function sanitizeReviewedBy(node) {
  if (!node || typeof node !== 'object' || !Object.hasOwn(node, 'reviewedBy')) return;
  const candidates = Array.isArray(node.reviewedBy) ? node.reviewedBy : [node.reviewedBy];
  const people = candidates.filter(isPersonReviewer);
  if (people.length === 0) {
    delete node.reviewedBy;
  } else {
    node.reviewedBy = Array.isArray(node.reviewedBy) ? people : people[0];
  }
}

function synchronizeJsonLdDates(blocks, meta) {
  const published = parseContentDate(meta?.publishedTime);
  const modified = parseContentDate(meta?.modifiedTime);

  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    sanitizeReviewedBy(node);
    if (hasSchemaType(node) && published && modified) {
      node.datePublished = published.raw;
      node.dateModified = modified.raw;
    }
    if (
      modified &&
      hasSchemaType(node, DATED_PAGE_SCHEMA_TYPES) &&
      Object.hasOwn(node, 'dateModified')
    ) {
      node.dateModified = modified.raw;
    }

    for (const value of Object.values(node)) visit(value);
  }

  return (Array.isArray(blocks) ? blocks : []).map((block) => {
    const parsed = parseJsonLdBlock(block);
    visit(parsed);
    return parsed;
  });
}

function synchronizeArticleJsonLdDates(blocks, meta) {
  return synchronizeJsonLdDates(blocks, meta);
}

function validateJsonLdDates(blocks, meta, options = {}) {
  const errors = [];
  let articleCount = 0;
  let datedPageCount = 0;

  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    if (hasSchemaType(node)) {
      articleCount += 1;
      if (node.datePublished !== meta?.publishedTime) {
        errors.push('Article datePublished must exactly match publishedTime');
      }
      if (node.dateModified !== meta?.modifiedTime) {
        errors.push('Article dateModified must exactly match modifiedTime');
      }
    }

    if (
      hasSchemaType(node, DATED_PAGE_SCHEMA_TYPES) &&
      Object.hasOwn(node, 'dateModified')
    ) {
      datedPageCount += 1;
      const modifiedResult = validateModifiedTime(meta?.modifiedTime, options);
      errors.push(...modifiedResult.errors);
      if (node.dateModified !== meta?.modifiedTime) {
        errors.push('WebPage/CollectionPage dateModified must exactly match modifiedTime');
      }
    }

    for (const value of Object.values(node)) visit(value);
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    visit(parseJsonLdBlock(block));
  }

  return { articleCount, datedPageCount, errors };
}

function formatVisibleDate(dateInfo, lang) {
  const locale = DATE_LOCALES[lang] || DATE_LOCALES.en;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(dateInfo.utcDate);
}

function removeLegacyVisibleUpdatedDates(bodyHtml) {
  const labelPattern = LEGACY_UPDATED_LABELS
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const paragraphPattern = new RegExp(
    `<p\\b[^>]*>\\s*(?:${labelPattern})\\b[\\s\\S]*?<\\/p>`,
    'gi'
  );
  return String(bodyHtml || '').replace(paragraphPattern, '');
}

function synchronizeVisibleArticleDate(bodyHtml, meta) {
  if (meta?.layout !== 'blogArticle') return bodyHtml;
  if (findFirstSchemaByType(meta.jsonLd, 'CollectionPage')) return bodyHtml;
  const modified = parseContentDate(meta.modifiedTime);
  if (!modified) return bodyHtml;

  const lang = meta.lang || 'en';
  const label = DATE_LABELS[lang] || DATE_LABELS.en;
  const formatted = formatVisibleDate(modified, lang);
  const dateHtml = [
    '<p class="mt-6 text-xs text-purple-200/60" data-article-modified>',
    `  ${escapeHtml(label)}: <time datetime="${escapeHtml(modified.raw)}">${escapeHtml(formatted)}</time>`,
    '</p>',
  ].join('\n');

  const cleaned = removeLegacyVisibleUpdatedDates(bodyHtml).trimEnd();
  const lastArticleClose = cleaned.lastIndexOf('</article>');
  if (lastArticleClose >= 0) {
    return `${cleaned.slice(0, lastArticleClose)}${dateHtml}\n${cleaned.slice(lastArticleClose)}`;
  }
  return `${cleaned}\n${dateHtml}\n`;
}

module.exports = {
  ARTICLE_SCHEMA_TYPES,
  DATED_PAGE_SCHEMA_TYPES,
  DATE_LABELS,
  EDITORIAL_TIME_ZONE,
  findFirstArticleSchema,
  findFirstSchemaByType,
  formatVisibleDate,
  hasSchemaType,
  parseContentDate,
  parseJsonLdBlock,
  removeLegacyVisibleUpdatedDates,
  sanitizeReviewedBy,
  synchronizeArticleJsonLdDates,
  synchronizeJsonLdDates,
  synchronizeVisibleArticleDate,
  todayDateOnly,
  validateArticleDates,
  validateJsonLdDates,
  validateModifiedTime,
};
