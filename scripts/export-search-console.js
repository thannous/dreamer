#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_SITE = 'sc-domain:noctalia.app';
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, 'marketing', 'seo', 'search-console');
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_ROOT = 'https://www.googleapis.com/webmasters/v3';
const MAX_ROW_LIMIT = 25000;

const DATASETS = [
  { id: 'summary', label: 'Synthese globale', dimensions: [], rowLimit: 1 },
  { id: 'daily', label: 'Evolution quotidienne', dimensions: ['date'] },
  { id: 'queries', label: 'Requetes', dimensions: ['query'] },
  { id: 'pages', label: 'Pages', dimensions: ['page'] },
  { id: 'page-query', label: 'Couples page + requete', dimensions: ['page', 'query'] },
  { id: 'countries', label: 'Pays', dimensions: ['country'] },
  { id: 'devices', label: 'Appareils', dimensions: ['device'] },
];

function printHelp() {
  console.log(`
Usage:
  npm run seo:gsc:export -- --start 2026-02-03 --end 2026-05-02

Options:
  --site <siteUrl>       Search Console site URL. Default: ${DEFAULT_SITE}
  --start <YYYY-MM-DD>   Start date. Default: 89 days before --end
  --end <YYYY-MM-DD>     End date. Default: 2 days ago
  --out <dir>            Output directory. Default: marketing/seo/search-console
  --row-limit <number>   API page size, capped at ${MAX_ROW_LIMIT}. Default: ${MAX_ROW_LIMIT}
  --help                 Show this help

Auth, in priority order:
  GSC_ACCESS_TOKEN
  GSC_OAUTH_CLIENT_ID + GSC_OAUTH_CLIENT_SECRET + GSC_OAUTH_REFRESH_TOKEN
  GOOGLE_APPLICATION_CREDENTIALS, GSC_SERVICE_ACCOUNT_JSON, or local ADC
  gcloud auth print-access-token, if gcloud is installed

Notes:
  - Service accounts must be added to Search Console for ${DEFAULT_SITE}.
  - Search Console API data is sampled/limited by Google for very large row sets.
`);
}

function parseArgs(argv) {
  const args = {
    site: process.env.GSC_SITE_URL || DEFAULT_SITE,
    out: process.env.GSC_OUTPUT_DIR || DEFAULT_OUT_DIR,
    rowLimit: Number(process.env.GSC_ROW_LIMIT || MAX_ROW_LIMIT),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    const key = arg.startsWith('--') ? arg.slice(2) : null;
    if (!key) throw new Error(`Unknown argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    i += 1;

    if (key === 'site') args.site = value;
    else if (key === 'start') args.start = value;
    else if (key === 'end') args.end = value;
    else if (key === 'out') args.out = path.resolve(ROOT_DIR, value);
    else if (key === 'row-limit') args.rowLimit = Number(value);
    else throw new Error(`Unknown option: ${arg}`);
  }

  args.rowLimit = Math.min(MAX_ROW_LIMIT, Math.max(1, Number(args.rowLimit || MAX_ROW_LIMIT)));
  args.end = args.end || dateToIso(addDays(new Date(), -2));
  args.start = args.start || dateToIso(addDays(parseIsoDate(args.end), -89));

  assertIsoDate(args.start, '--start');
  assertIsoDate(args.end, '--end');
  if (args.start > args.end) throw new Error('--start must be before or equal to --end');

  return args;
}

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format, got: ${value}`);
  }
}

function parseIsoDate(value) {
  assertIsoDate(value, 'date');
  return new Date(`${value}T00:00:00Z`);
}

function dateToIso(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toUrlSafeBase64(payload) {
  const value = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  return value
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  if (process.env.GSC_ACCESS_TOKEN) {
    return {
      token: process.env.GSC_ACCESS_TOKEN.trim(),
      quotaProjectId: process.env.GSC_QUOTA_PROJECT_ID || '',
    };
  }

  if (
    process.env.GSC_OAUTH_CLIENT_ID &&
    process.env.GSC_OAUTH_CLIENT_SECRET &&
    process.env.GSC_OAUTH_REFRESH_TOKEN
  ) {
    return {
      token: await refreshOAuthToken(),
      quotaProjectId: process.env.GSC_QUOTA_PROJECT_ID || '',
    };
  }

  const credential = readGoogleCredential();
  if (credential?.type === 'service_account' || credential?.private_key) {
    return {
      token: await getServiceAccountAccessToken(credential),
      quotaProjectId: process.env.GSC_QUOTA_PROJECT_ID || credential.project_id || '',
    };
  }

  if (credential?.type === 'authorized_user' || credential?.refresh_token) {
    return {
      token: await refreshAuthorizedUserToken(credential),
      quotaProjectId: process.env.GSC_QUOTA_PROJECT_ID || credential.quota_project_id || '',
    };
  }

  try {
    const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const quotaProjectId =
      process.env.GSC_QUOTA_PROJECT_ID ||
      execFileSync('gcloud', ['config', 'get-value', 'project'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    return { token, quotaProjectId };
  } catch {
    // Keep the actionable error below.
  }

  throw new Error(
    [
      'No Search Console API credential found.',
      'Set GSC_ACCESS_TOKEN, OAuth refresh token env vars, GOOGLE_APPLICATION_CREDENTIALS,',
      'or install/login gcloud and run `gcloud auth application-default login` / `gcloud auth login`.',
    ].join(' ')
  );
}

function readGoogleCredential() {
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  }

  const adcPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  if (fs.existsSync(adcPath)) {
    return JSON.parse(fs.readFileSync(adcPath, 'utf8'));
  }

  return null;
}

async function refreshOAuthToken() {
  return refreshAuthorizedUserToken({
    client_id: process.env.GSC_OAUTH_CLIENT_ID,
    client_secret: process.env.GSC_OAUTH_CLIENT_SECRET,
    refresh_token: process.env.GSC_OAUTH_REFRESH_TOKEN,
  });
}

async function refreshAuthorizedUserToken(credential) {
  if (!credential.client_id || !credential.client_secret || !credential.refresh_token) {
    throw new Error(
      'OAuth credential must include client_id, client_secret, and refresh_token'
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credential.client_id,
      client_secret: credential.client_secret,
      refresh_token: credential.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OAuth token refresh failed: ${JSON.stringify(payload)}`);
  }

  return payload.access_token;
}

async function getServiceAccountAccessToken(serviceAccount) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON must include client_email and private_key');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: SEARCH_CONSOLE_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${toUrlSafeBase64(JSON.stringify(header))}.${toUrlSafeBase64(
    JSON.stringify(claimSet)
  )}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(serviceAccount.private_key);
  const assertion = `${unsignedJwt}.${toUrlSafeBase64(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Service account token exchange failed: ${JSON.stringify(payload)}`);
  }

  return payload.access_token;
}

async function querySearchAnalytics({
  token,
  quotaProjectId,
  site,
  startDate,
  endDate,
  dimensions,
  rowLimit,
}) {
  const rows = [];
  let startRow = 0;

  while (true) {
    const body = {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
    };

    const response = await fetch(
      `${API_ROOT}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          ...(quotaProjectId ? { 'x-goog-user-project': quotaProjectId } : {}),
        },
        body: JSON.stringify(body),
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `Search Console query failed for dimensions [${dimensions.join(', ')}]: ${JSON.stringify(
          payload
        )}`
      );
    }

    const batch = payload.rows || [];
    rows.push(...batch.map((row) => normalizeRow(row, dimensions)));
    if (batch.length < rowLimit || dimensions.length === 0) break;
    startRow += rowLimit;
  }

  return rows;
}

function normalizeRow(row, dimensions) {
  const next = {
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  };

  for (let i = 0; i < dimensions.length; i += 1) {
    next[dimensions[i]] = row.keys?.[i] || '';
  }

  return next;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString('fr-FR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function csvEscape(value) {
  if (value == null) return '';
  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadSiteIndex() {
  const manifestPath = path.join(ROOT_DIR, 'data', 'site-manifest.json');
  if (!fs.existsSync(manifestPath)) return new Map();

  const siteConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'docs-src', 'config', 'site.config.json'), 'utf8')
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const index = new Map();

  for (const [collectionId, collection] of Object.entries(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      for (const [lang, locale] of Object.entries(entry.locales || {})) {
        if (!locale.path) continue;
        const sourceFile = resolveSourceFile(collectionId, entry.id, lang);
        const meta = sourceFile && fs.existsSync(sourceFile) ? readFrontMatter(sourceFile) : null;
        const record = {
          collection: collectionId,
          entryId: entry.id,
          lang,
          path: locale.path,
          url: `${siteConfig.domain}${locale.path}`,
          sourceFile: sourceFile && fs.existsSync(sourceFile) ? path.relative(ROOT_DIR, sourceFile) : '',
          title: meta?.title || '',
          description: meta?.description || '',
        };

        for (const key of urlLookupKeys(record.url, siteConfig.domain)) {
          index.set(key, record);
        }
      }
    }
  }

  return index;
}

function resolveSourceFile(collectionId, entryId, lang) {
  if (collectionId === 'blog') {
    return path.join(ROOT_DIR, 'docs-src', 'content', 'blog', entryId, `${lang}.md`);
  }

  if (collectionId === 'pages') {
    return path.join(ROOT_DIR, 'docs-src', 'content', 'pages', entryId, `${lang}.md`);
  }

  if (collectionId === 'guides') {
    if (entryId.startsWith('guide.') && !['guide.index', 'guide.dictionary'].includes(entryId)) {
      return path.join(ROOT_DIR, 'docs', 'data', 'curation-pages.json');
    }

    return path.join(ROOT_DIR, 'docs', 'data', 'symbol-i18n.json');
  }

  if (collectionId === 'symbols') {
    if (entryId.startsWith('symbolCategory.')) {
      return path.join(ROOT_DIR, 'docs', 'data', 'symbol-i18n.json');
    }

    return path.join(ROOT_DIR, 'data', 'dream-symbols.json');
  }

  return '';
}

function readFrontMatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function urlLookupKeys(url, domain) {
  const parsed = new URL(url);
  const pathOnly = normalizePath(`${parsed.pathname}${parsed.search || ''}`);
  const withoutSearch = normalizePath(parsed.pathname);
  return [
    normalizeUrl(url),
    normalizeUrl(url).replace(/\/$/, ''),
    `${domain}${withoutSearch}`,
    `${domain}${withoutSearch}`.replace(/\/$/, ''),
    pathOnly,
    pathOnly.replace(/\/$/, ''),
    withoutSearch,
    withoutSearch.replace(/\/$/, ''),
  ];
}

function normalizeUrl(value) {
  const parsed = new URL(value);
  parsed.hash = '';
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.toString();
}

function normalizePath(value) {
  const parsed = value.startsWith('http') ? new URL(value).pathname : value;
  if (parsed === '/') return '/';
  return parsed.replace(/\/$/, '');
}

function enrichPageRows(rows, siteIndex) {
  return rows.map((row) => {
    const match = siteIndex.get(normalizeUrl(row.page)) || siteIndex.get(normalizeUrl(row.page).replace(/\/$/, ''));
    return {
      ...row,
      entryId: match?.entryId || '',
      lang: match?.lang || inferLangFromUrl(row.page),
      sourceFile: match?.sourceFile || '',
      title: match?.title || '',
      description: match?.description || '',
    };
  });
}

function enrichPageQueryRows(rows, siteIndex) {
  return rows.map((row) => {
    const match = siteIndex.get(normalizeUrl(row.page)) || siteIndex.get(normalizeUrl(row.page).replace(/\/$/, ''));
    return {
      ...row,
      entryId: match?.entryId || '',
      lang: match?.lang || inferLangFromUrl(row.page),
      sourceFile: match?.sourceFile || '',
    };
  });
}

function inferLangFromUrl(url) {
  try {
    const first = new URL(url).pathname.split('/').filter(Boolean)[0];
    return ['en', 'fr', 'es', 'de', 'it'].includes(first) ? first : '';
  } catch {
    return '';
  }
}

function buildOpportunities(data) {
  const queries = data.queries || [];
  const pages = data.pages || [];
  const pageQueries = data['page-query'] || [];

  const queryQuickWins = queries
    .filter((row) => row.impressions >= 100 && row.position >= 4 && row.position <= 20)
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 25);

  const ctrOpportunities = pages
    .filter((row) => row.impressions >= 100 && row.ctr < 0.01 && row.position <= 20)
    .sort((a, b) => b.impressions - a.impressions || a.ctr - b.ctr)
    .slice(0, 25);

  const contentRefreshes = pages
    .filter((row) => row.impressions >= 100 && row.position > 10 && row.position <= 30)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .slice(0, 25);

  const pageQueryFocus = pageQueries
    .filter((row) => row.impressions >= 50 && row.position >= 4 && row.position <= 25)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .slice(0, 40);

  return {
    queryQuickWins,
    ctrOpportunities,
    contentRefreshes,
    pageQueryFocus,
  };
}

function markdownTable(rows, columns, maxRows = 12) {
  if (!rows.length) return '_Aucune ligne dans cette categorie pour cette periode._';
  const selected = rows.slice(0, maxRows);
  const header = `| ${columns.map((column) => column.label).join(' |')} |`;
  const separator = `| ${columns.map(() => '---').join(' |')} |`;
  const body = selected.map(
    (row) =>
      `| ${columns
        .map((column) => {
          const raw = column.value(row);
          return String(raw == null ? '' : raw).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        })
        .join(' |')} |`
  );
  return [header, separator, ...body].join('\n');
}

function buildReport({ args, data, outputDir, generatedAt }) {
  const summary = data.summary?.[0] || {};
  const opportunities = buildOpportunities(data);

  return `# Search Console Noctalia - plan SEO hebdomadaire

Generation: ${generatedAt}
Propriete: \`${args.site}\`
Periode: ${args.start} -> ${args.end}

## Synthese

- Clics: ${formatNumber(summary.clicks)}
- Impressions: ${formatNumber(summary.impressions)}
- CTR moyen: ${formatPercent(summary.ctr)}
- Position moyenne: ${formatNumber(summary.position, 1)}

Les fichiers CSV source sont dans \`${path.relative(ROOT_DIR, outputDir)}\`. Les lignes \`sourceFile\` pointent vers \`docs-src\` quand l'URL Search Console correspond au manifeste local.

## Actions prioritaires

1. **Ameliorer les pages a fortes impressions et CTR faible.** Recrire title/meta description, clarifier l'intention de recherche dans l'intro, ajouter FAQ/schema si pertinent.
2. **Renforcer les requetes en positions 4-20.** Ajouter des sections qui repondent explicitement aux requetes, puis mailler depuis les pages proches.
3. **Rafraichir les pages en positions 10-30.** Completer le contenu, ajouter exemples, sources et liens internes depuis les hubs.
4. **Suivre chaque semaine les deltas.** Comparer le rapport courant avec le precedent et ne modifier qu'un lot de pages a la fois.

## Requetes a fort potentiel

${markdownTable(opportunities.queryQuickWins, [
  { label: 'Requete', value: (row) => row.query },
  { label: 'Clics', value: (row) => formatNumber(row.clicks) },
  { label: 'Impr.', value: (row) => formatNumber(row.impressions) },
  { label: 'CTR', value: (row) => formatPercent(row.ctr) },
  { label: 'Pos.', value: (row) => formatNumber(row.position, 1) },
])}

## Pages a CTR faible

${markdownTable(opportunities.ctrOpportunities, [
  { label: 'Page', value: (row) => row.page },
  { label: 'Source', value: (row) => row.sourceFile },
  { label: 'Impr.', value: (row) => formatNumber(row.impressions) },
  { label: 'CTR', value: (row) => formatPercent(row.ctr) },
  { label: 'Pos.', value: (row) => formatNumber(row.position, 1) },
])}

## Pages a rafraichir

${markdownTable(opportunities.contentRefreshes, [
  { label: 'Page', value: (row) => row.page },
  { label: 'Source', value: (row) => row.sourceFile },
  { label: 'Impr.', value: (row) => formatNumber(row.impressions) },
  { label: 'CTR', value: (row) => formatPercent(row.ctr) },
  { label: 'Pos.', value: (row) => formatNumber(row.position, 1) },
])}

## Couples page + requete a traiter

${markdownTable(opportunities.pageQueryFocus, [
  { label: 'Requete', value: (row) => row.query },
  { label: 'Page', value: (row) => row.page },
  { label: 'Source', value: (row) => row.sourceFile },
  { label: 'Impr.', value: (row) => formatNumber(row.impressions) },
  { label: 'Pos.', value: (row) => formatNumber(row.position, 1) },
], 20)}

## Rituel de travail

- Lundi: lancer l'export, choisir 3 a 5 pages dans les sections ci-dessus.
- Mardi/mercredi: modifier les contenus \`docs-src\`, titles, descriptions, FAQ et liens internes.
- Jeudi: lancer \`npm run docs:release-check\`.
- Vendredi: publier, puis annoter les changements dans ce rapport ou dans un changelog SEO.
- Semaine suivante: comparer impressions, CTR et position moyenne avant de refaire le meme type de changements.

## Rappel methodologique

- Une position 4-20 avec beaucoup d'impressions est souvent le meilleur levier court terme.
- Une page avec impressions fortes et CTR faible doit d'abord travailler son extrait SERP.
- Les donnees Search Console peuvent etre retardees de quelques jours et bornees par Google; garder les comparaisons sur des periodes coherentes.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const generatedAt = new Date().toISOString();
  const runId = `${args.start}_to_${args.end}`;
  const outputDir = path.join(args.out, runId);
  const { token, quotaProjectId } = await getAccessToken();
  ensureDir(outputDir);
  const siteIndex = loadSiteIndex();
  const data = {};

  for (const dataset of DATASETS) {
    console.log(
      `[search-console] fetching ${dataset.id} (${dataset.dimensions.join(', ') || 'summary'})`
    );
    data[dataset.id] = await querySearchAnalytics({
      token,
      quotaProjectId,
      site: args.site,
      startDate: args.start,
      endDate: args.end,
      dimensions: dataset.dimensions,
      rowLimit: dataset.rowLimit || args.rowLimit,
    });
  }

  data.pages = enrichPageRows(data.pages, siteIndex);
  data['page-query'] = enrichPageQueryRows(data['page-query'], siteIndex);

  const summary = {
    generatedAt,
    site: args.site,
    startDate: args.start,
    endDate: args.end,
    datasets: Object.fromEntries(
      Object.entries(data).map(([id, rows]) => [id, { rows: rows.length }])
    ),
    totals: data.summary?.[0] || null,
    notes: [
      'Search Analytics rows are returned by Google Search Console API and can be limited by Google internal constraints.',
      'Output files are intended for SEO planning and should usually remain uncommitted.',
    ],
  };

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeCsv(path.join(outputDir, 'summary.csv'), data.summary, [
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'daily.csv'), data.daily, [
    'date',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'queries.csv'), data.queries, [
    'query',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'pages.csv'), data.pages, [
    'page',
    'entryId',
    'lang',
    'sourceFile',
    'title',
    'description',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'page-query.csv'), data['page-query'], [
    'page',
    'query',
    'entryId',
    'lang',
    'sourceFile',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'countries.csv'), data.countries, [
    'country',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);
  writeCsv(path.join(outputDir, 'devices.csv'), data.devices, [
    'device',
    'clicks',
    'impressions',
    'ctr',
    'position',
  ]);

  fs.writeFileSync(
    path.join(outputDir, 'action-plan.md'),
    buildReport({ args, data, outputDir, generatedAt }),
    'utf8'
  );

  console.log(`[search-console] wrote ${path.relative(ROOT_DIR, outputDir)}`);
}

main().catch((error) => {
  console.error(`[search-console] ${error.message}`);
  process.exitCode = 1;
});
