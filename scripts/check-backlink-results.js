#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = path.join(
  __dirname,
  '..',
  'marketing',
  'seo',
  'backlink-results-2026-07-31.csv'
);
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 3;
const NOCTALIA_HOSTS = new Set(['noctalia.app', 'www.noctalia.app']);
const REQUIRED_HEADERS = [
  'domain',
  'referring_page',
  'linked_url',
  'http_status',
  'indexability',
  'canonical',
  'link_rel',
  'authority_treatment',
  'first_verified',
  'last_verified',
  'next_check',
  'external_action_status',
  'notes',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    concurrency: DEFAULT_CONCURRENCY,
    input: DEFAULT_INPUT,
    json: false,
    strict: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--help') options.help = true;
    else if (arg.startsWith('--input=')) options.input = path.resolve(arg.slice('--input='.length));
    else if (arg.startsWith('--timeout-ms=')) options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg.startsWith('--concurrency=')) options.concurrency = Number(arg.slice('--concurrency='.length));
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100) {
    throw new Error('--timeout-ms must be an integer of at least 100');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 20) {
    throw new Error('--concurrency must be an integer between 1 and 20');
  }

  return options;
}

function parseCsvRows(input) {
  const source = String(input || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

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

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV ended inside a quoted field');
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function parseCsv(input) {
  const rows = parseCsvRows(input);
  if (rows.length === 0) throw new Error('CSV is empty');

  const headers = rows[0];
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) throw new Error(`CSV is missing required header: ${required}`);
  }

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`
      );
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

function normalizeUrl(raw) {
  const url = new URL(raw);
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function normalizeLinkedUrl(raw) {
  const url = new URL(normalizeUrl(raw));
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith('utm_') || normalizedKey === 'ref') {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

function relTokens(raw) {
  return String(raw || '')
    .toLowerCase()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseTagAttributes(rawTag) {
  const attributes = new Map();
  const pattern = /([:@\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(rawTag))) {
    attributes.set(
      match[1].toLowerCase(),
      decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? '')
    );
  }
  return attributes;
}

function matchTags(content, tagName) {
  return String(content || '').match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

function robotsTokens(...values) {
  return values
    .flatMap((value) => String(value || '').toLowerCase().split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isNoctaliaUrl(raw, baseUrl) {
  try {
    return NOCTALIA_HOSTS.has(new URL(raw, baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function analyzeHtml({ html, pageUrl, status, xRobotsTag = '' }) {
  const metaRobots = matchTags(html, 'meta')
    .map(parseTagAttributes)
    .filter((attributes) => ['robots', 'googlebot'].includes((attributes.get('name') || '').toLowerCase()))
    .map((attributes) => attributes.get('content') || '');
  const robotDirectives = robotsTokens(...metaRobots, xRobotsTag);
  const canonicalAttributes = matchTags(html, 'link')
    .map(parseTagAttributes)
    .find((attributes) => relTokens(attributes.get('rel')).includes('canonical'));
  const canonicalHref = canonicalAttributes ? canonicalAttributes.get('href') : null;
  const canonical = canonicalHref ? new URL(canonicalHref, pageUrl).toString() : null;

  const noctaliaLinks = matchTags(html, 'a')
    .map(parseTagAttributes)
    .filter((attributes) => attributes.get('href'))
    .filter((attributes) => isNoctaliaUrl(attributes.get('href'), pageUrl))
    .map((attributes) => ({
      href: new URL(attributes.get('href'), pageUrl).toString(),
      rel: relTokens(attributes.get('rel')),
    }));

  const blockingRel = new Set(['nofollow', 'sponsored', 'ugc']);
  const followedLinks = noctaliaLinks.filter(
    (link) => !link.rel.some((token) => blockingRel.has(token))
  );
  const nonFollowedLinks = noctaliaLinks.filter(
    (link) => link.rel.some((token) => blockingRel.has(token))
  );
  const successful = status >= 200 && status < 400;
  const indexability = successful
    ? robotDirectives.includes('noindex')
      ? 'non_indexable'
      : 'indexable'
    : 'unverified';

  let observedTreatment = `http_${status}`;
  if (successful && indexability === 'non_indexable') observedTreatment = 'non_indexable';
  else if (successful && followedLinks.length > 0) observedTreatment = 'followed';
  else if (successful && nonFollowedLinks.length > 0) observedTreatment = 'nofollow';
  else if (successful) observedTreatment = 'missing_link';

  return {
    canonical,
    followedLinks,
    indexability,
    noctaliaLinks,
    nonFollowedLinks,
    observedTreatment,
    pageUrl,
    robotDirectives,
    status,
  };
}

function expectedIndexability(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('noindex')) return 'non_indexable';
  if (value === 'indexable' || value.includes('index, follow')) return 'indexable';
  return null;
}

function findTargetLinks(evidence, targetUrl) {
  let expected;
  try {
    expected = normalizeLinkedUrl(targetUrl);
  } catch {
    return [];
  }
  return evidence.noctaliaLinks.filter((link) => normalizeLinkedUrl(link.href) === expected);
}

function evaluateEvidence(row, evidence) {
  const mismatches = [];
  const expectedStatus = Number(row.http_status);
  const knownBlocked = row.authority_treatment === 'store_derived_unverified';
  const expectedMissing = ['lost', 'missing_link'].includes(row.authority_treatment);
  const expectedNonIndexableMissing =
    row.authority_treatment === 'non_indexable_missing_link';

  if (Number.isInteger(expectedStatus) && evidence.status !== expectedStatus) {
    mismatches.push(`HTTP ${evidence.status}, expected ${expectedStatus}`);
  }

  const indexability = expectedIndexability(row.indexability);
  if (indexability && evidence.indexability !== indexability) {
    mismatches.push(`${evidence.indexability}, expected ${indexability}`);
  }

  if (row.canonical === 'self' && evidence.status >= 200 && evidence.status < 400) {
    if (!evidence.canonical) mismatches.push('canonical missing');
    else if (normalizeUrl(evidence.canonical) !== normalizeUrl(evidence.pageUrl)) {
      mismatches.push(`canonical points to ${evidence.canonical}`);
    }
  }

  if (
    !knownBlocked &&
    !expectedMissing &&
    !expectedNonIndexableMissing &&
    evidence.status >= 200 &&
    evidence.status < 400
  ) {
    const targetLinks = findTargetLinks(evidence, row.linked_url);
    if (targetLinks.length === 0) {
      const observed = evidence.noctaliaLinks.map((link) => link.href).join(', ') || 'none';
      mismatches.push(`expected link missing: ${row.linked_url}; observed: ${observed}`);
    }
  }

  if (row.authority_treatment === 'followed' && evidence.observedTreatment !== 'followed') {
    mismatches.push(`authority is ${evidence.observedTreatment}, expected followed`);
  } else if (row.authority_treatment === 'nofollow' && evidence.observedTreatment !== 'nofollow') {
    mismatches.push(`authority is ${evidence.observedTreatment}, expected nofollow`);
  } else if (
    row.authority_treatment === 'non_indexable' &&
    evidence.indexability !== 'non_indexable'
  ) {
    mismatches.push(`authority page is ${evidence.indexability}, expected non_indexable`);
  } else if (
    expectedNonIndexableMissing &&
    (evidence.indexability !== 'non_indexable' || evidence.noctaliaLinks.length > 0)
  ) {
    mismatches.push(
      `authority is ${evidence.observedTreatment} with ${evidence.noctaliaLinks.length} Noctalia link(s), expected non_indexable_missing_link`
    );
  } else if (expectedMissing && evidence.observedTreatment !== 'missing_link') {
    mismatches.push(`authority is ${evidence.observedTreatment}, expected missing_link`);
  }

  if (String(row.link_rel).startsWith('mixed:') && evidence.status >= 200 && evidence.status < 400) {
    if (evidence.followedLinks.length === 0 || evidence.nonFollowedLinks.length === 0) {
      mismatches.push('expected a mix of followed and non-followed Noctalia links');
    }
  }

  return mismatches;
}

async function auditRow(row, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(row.referring_page, {
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (compatible; NoctaliaBacklinkVerifier/1.0; +https://noctalia.app)',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const html = await response.text();
    const evidence = analyzeHtml({
      html,
      pageUrl: response.url || row.referring_page,
      status: response.status,
      xRobotsTag: response.headers.get('x-robots-tag') || '',
    });
    const mismatches = evaluateEvidence(row, evidence);
    return { domain: row.domain, error: null, evidence, mismatches, row };
  } catch (error) {
    return {
      domain: row.domain,
      error: error instanceof Error ? error.message : String(error),
      evidence: null,
      mismatches: [`fetch failed: ${error instanceof Error ? error.message : String(error)}`],
      row,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function summarize(results) {
  const treatments = {};
  for (const result of results) {
    const treatment = result.evidence ? result.evidence.observedTreatment : 'fetch_error';
    treatments[treatment] = (treatments[treatment] || 0) + 1;
  }
  return {
    checked: results.length,
    mismatched: results.filter((result) => result.mismatches.length > 0).length,
    treatments,
  };
}

function printText(results, summary, input) {
  console.log(`Backlink verification: ${path.relative(process.cwd(), input) || input}`);
  for (const result of results) {
    if (result.error) {
      console.log(`! ${result.domain}: fetch failed (${result.error})`);
      continue;
    }
    const { evidence } = result;
    const marker = result.mismatches.length === 0 ? '✓' : '✗';
    const canonical = evidence.canonical ? 'canonical' : 'no-canonical';
    console.log(
      `${marker} ${result.domain}: HTTP ${evidence.status} | ${evidence.indexability} | ${canonical} | ${evidence.observedTreatment}`
    );
    for (const mismatch of result.mismatches) console.log(`    - ${mismatch}`);
  }
  console.log(
    `Summary: ${summary.checked} checked | ${summary.mismatched} changed or unreachable | ${JSON.stringify(summary.treatments)}`
  );
  console.log('Read-only check: no tracker file was modified.');
}

async function run(options, dependencies = {}) {
  const csv = fs.readFileSync(options.input, 'utf8');
  const rows = parseCsv(csv);
  const results = await mapLimit(rows, options.concurrency, (row) =>
    auditRow(row, { fetchImpl: dependencies.fetchImpl || fetch, timeoutMs: options.timeoutMs })
  );
  return { input: options.input, results, summary: summarize(results) };
}

function printHelp() {
  console.log(`Usage: node scripts/check-backlink-results.js [options]

Options:
  --input=PATH       CSV tracker to verify
  --timeout-ms=N     Per-page timeout (default: ${DEFAULT_TIMEOUT_MS})
  --concurrency=N    Concurrent requests, 1-20 (default: ${DEFAULT_CONCURRENCY})
  --json             Emit structured JSON
  --strict           Exit non-zero when evidence differs or a fetch fails
  --help             Show this help

This command is read-only. It never rewrites the backlink tracker.`);
}

async function main() {
  try {
    const options = parseArgs();
    if (options.help) {
      printHelp();
      return;
    }
    const report = await run(options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printText(report.results, report.summary, report.input);
    if (options.strict && report.summary.mismatched > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  analyzeHtml,
  auditRow,
  decodeHtmlAttribute,
  evaluateEvidence,
  matchTags,
  mapLimit,
  normalizeLinkedUrl,
  normalizeUrl,
  parseArgs,
  parseCsv,
  parseCsvRows,
  parseTagAttributes,
  run,
  summarize,
};
