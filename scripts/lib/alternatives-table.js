const fs = require('fs');
const path = require('path');

const { STATIC_DATA_DIR } = require('./docs-site-config');
const { escapeHtml } = require('./docs-source-utils');

const COMPARISON_DATA_PATH = path.join(
  STATIC_DATA_DIR,
  'dream-journal-apps-comparison-2026.csv'
);
const REQUIRED_COLUMNS = ['app', 'source_url', 'last_reviewed'];
const TABLE_COPY_KEYS = [
  'alternativesTableCaption',
  'alternativesTableHint',
  'alternativesTableSource',
  'alternativesTableReviewed',
];

let comparisonDataCache;

function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('Comparison CSV ended inside a quoted field');
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows.filter((values) => values.some((value) => value.trim()));
}

function parseComparisonData(input) {
  const rows = parseCsvRows(String(input || ''));
  if (rows.length < 2) throw new Error('Comparison CSV must contain a header and data rows');

  const headers = rows[0].map((value) => value.trim());
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new Error(`Comparison CSV is missing required column "${required}"`);
    }
  }

  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `Comparison CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`
      );
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });

  const byApp = new Map();
  for (const record of records) {
    if (!record.app) throw new Error('Comparison CSV contains a row without an app name');
    if (byApp.has(record.app)) {
      throw new Error(`Comparison CSV contains duplicate app "${record.app}"`);
    }
    try {
      const source = new URL(record.source_url);
      if (!/^https?:$/.test(source.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new Error(`Comparison CSV contains an invalid source_url for "${record.app}"`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.last_reviewed)) {
      throw new Error(`Comparison CSV contains an invalid last_reviewed for "${record.app}"`);
    }
    byApp.set(record.app, record);
  }

  if (byApp.size !== 11) {
    throw new Error(`Comparison CSV must contain exactly 11 apps; found ${byApp.size}`);
  }

  return byApp;
}

function loadComparisonData() {
  if (!comparisonDataCache) {
    comparisonDataCache = parseComparisonData(fs.readFileSync(COMPARISON_DATA_PATH, 'utf8'));
  }
  return comparisonDataCache;
}

function decodeHtmlText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function setAttribute(tag, name, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`\\s${name}=(['"])[\\s\\S]*?\\1`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escaped}"`);
  return tag.replace(/>$/, ` ${name}="${escaped}">`);
}

function updateClassNames(tag, { add = [], remove = [] } = {}) {
  const current = tag.match(/\sclass=(['"])([\s\S]*?)\1/i)?.[2] || '';
  const removeSet = new Set(remove);
  const classes = current.split(/\s+/).filter(Boolean).filter((name) => !removeSet.has(name));
  for (const name of add) {
    if (name && !classes.includes(name)) classes.push(name);
  }
  return setAttribute(tag, 'class', classes.join(' '));
}

function tableCopy(locale) {
  const missing = TABLE_COPY_KEYS.filter((key) => !String(locale?.[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing alternatives table locale strings: ${missing.join(', ')}`);
  }
  return Object.fromEntries(TABLE_COPY_KEYS.map((key) => [key, locale[key].trim()]));
}

function formatReviewDate(value, languageTag) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid comparison review date "${value}"`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(languageTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function renderRowHeader({ attributes, content, app, record, labels, languageTag, columnLabel }) {
  let tag = `<th${attributes}>`;
  tag = setAttribute(tag, 'scope', 'row');
  tag = setAttribute(tag, 'data-label', columnLabel);
  tag = updateClassNames(tag, { add: ['alternatives-table-row-header'] });

  const sourceLabel = labels.alternativesTableSource;
  const reviewedLabel = labels.alternativesTableReviewed;
  const sourceLink = [
    `<a href="${escapeHtml(record.source_url)}"`,
    ' class="alternatives-table-source-link"',
    ` aria-label="${escapeHtml(`${sourceLabel}: ${app}`)}"`,
    ' rel="nofollow noopener noreferrer" target="_blank">',
    `${escapeHtml(sourceLabel)}</a>`,
  ].join('');
  const reviewDate = `<time datetime="${escapeHtml(record.last_reviewed)}">${escapeHtml(
    formatReviewDate(record.last_reviewed, languageTag)
  )}</time>`;

  return [
    tag,
    `<span class="alternatives-table-app-name">${content}</span>`,
    '<span class="alternatives-table-source-meta">',
    sourceLink,
    `<span class="alternatives-table-review">${escapeHtml(reviewedLabel)} ${reviewDate}</span>`,
    '</span>',
    '</th>',
  ].join('');
}

function enhanceAlternativesTable(
  bodyHtml,
  { lang, languageTag = lang, locale, comparisonData = loadComparisonData() }
) {
  const source = String(bodyHtml || '');
  const labels = tableCopy(locale);
  const tableMatches = [...source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  if (tableMatches.length !== 1) {
    throw new Error(`page.alternatives must contain exactly one comparison table; found ${tableMatches.length}`);
  }

  const tableMatch = tableMatches[0];
  const tableHtml = tableMatch[0];
  const tableOpen = tableHtml.match(/^<table\b[^>]*>/i)?.[0];
  const thead = tableHtml.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/i)?.[0];
  const tbody = tableHtml.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/i)?.[0];
  if (!tableOpen || !thead || !tbody) {
    throw new Error('page.alternatives comparison table must contain thead and tbody');
  }

  const headerCells = [...thead.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)];
  if (headerCells.length !== 11) {
    throw new Error(`page.alternatives comparison table must contain 11 columns; found ${headerCells.length}`);
  }
  const columnLabels = headerCells.map((match) => decodeHtmlText(match[2]));
  if (columnLabels.some((label) => !label)) {
    throw new Error('page.alternatives comparison table contains an empty column label');
  }

  const enhancedThead = thead.replace(
    /<th\b([^>]*)>([\s\S]*?)<\/th>/gi,
    (_cell, attributes, content) => {
      let tag = `<th${attributes}>`;
      tag = setAttribute(tag, 'scope', 'col');
      return `${tag}${content}</th>`;
    }
  );

  let rowCount = 0;
  const seenApps = new Set();
  const enhancedTbody = tbody.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi, (_row, rowAttrs, rowHtml) => {
    const cells = [...rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length !== columnLabels.length) {
      throw new Error(
        `page.alternatives row ${rowCount + 1} has ${cells.length} cells; expected ${columnLabels.length}`
      );
    }

    const app = decodeHtmlText(cells[0][2]);
    const record = comparisonData.get(app);
    if (!record) throw new Error(`page.alternatives row "${app}" has no matching CSV source record`);
    if (seenApps.has(app)) throw new Error(`page.alternatives contains duplicate row "${app}"`);
    seenApps.add(app);
    rowCount += 1;

    let cellIndex = 0;
    const enhancedCells = rowHtml.replace(
      /<td\b([^>]*)>([\s\S]*?)<\/td>/gi,
      (_cell, attributes, content) => {
        const columnLabel = columnLabels[cellIndex];
        const currentIndex = cellIndex;
        cellIndex += 1;
        if (currentIndex === 0) {
          return renderRowHeader({
            attributes,
            content,
            app,
            record,
            labels,
            languageTag,
            columnLabel,
          });
        }
        let tag = `<td${attributes}>`;
        tag = setAttribute(tag, 'data-label', columnLabel);
        return `${tag}<span class="alternatives-table-value">${content}</span></td>`;
      }
    );
    return `<tr${rowAttrs}>${enhancedCells}</tr>`;
  });

  if (rowCount !== comparisonData.size || seenApps.size !== comparisonData.size) {
    const missing = [...comparisonData.keys()].filter((app) => !seenApps.has(app));
    throw new Error(
      `page.alternatives must contain all ${comparisonData.size} CSV apps` +
        (missing.length > 0 ? `; missing ${missing.join(', ')}` : '')
    );
  }

  const tableTag = updateClassNames(tableOpen, {
    add: ['alternatives-table'],
    remove: ['min-w-[1100px]'],
  });
  const hintId = `alternatives-table-hint-${String(lang).replace(/[^a-z0-9-]+/gi, '-')}`;
  const tableWithSemantics = tableHtml
    .replace(tableOpen, setAttribute(tableTag, 'aria-describedby', hintId))
    .replace(thead, enhancedThead)
    .replace(tbody, enhancedTbody)
    .replace(
      />/,
      `><caption class="alternatives-table-caption">${escapeHtml(
        labels.alternativesTableCaption
      )}</caption>`
    );
  const enhancedTable = [
    `<p class="alternatives-table-hint" id="${escapeHtml(hintId)}">${escapeHtml(
      labels.alternativesTableHint
    )}</p>`,
    `<div class="alternatives-table-region" role="region" aria-label="${escapeHtml(
      labels.alternativesTableCaption
    )}" aria-describedby="${escapeHtml(hintId)}" tabindex="0">`,
    tableWithSemantics,
    '</div>',
  ].join('\n');

  const tableIndex = tableMatch.index;
  const sectionStart = source.lastIndexOf('<section', tableIndex);
  const sectionOpenEnd = sectionStart >= 0 ? source.indexOf('>', sectionStart) : -1;
  const sectionClose = source.indexOf('</section>', tableIndex + tableHtml.length);
  if (sectionStart < 0 || sectionOpenEnd < 0 || sectionClose < 0) {
    throw new Error('page.alternatives comparison table must be contained by a section');
  }

  const sectionHtml = source.slice(sectionStart, sectionClose + '</section>'.length);
  const sectionOpen = source.slice(sectionStart, sectionOpenEnd + 1);
  const enhancedSectionOpen = updateClassNames(sectionOpen, {
    add: ['alternatives-table-section'],
    remove: ['overflow-x-auto'],
  });
  const enhancedSection = sectionHtml
    .replace(sectionOpen, enhancedSectionOpen)
    .replace(tableHtml, enhancedTable);

  return `${source.slice(0, sectionStart)}${enhancedSection}${source.slice(
    sectionClose + '</section>'.length
  )}`;
}

module.exports = {
  COMPARISON_DATA_PATH,
  enhanceAlternativesTable,
  formatReviewDate,
  loadComparisonData,
  parseComparisonData,
  parseCsvRows,
};
