#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discoverExecutionCards, parseExecutionCard } = require('./check-social-execution-card');
const { assetFromCell, parseTableRows, validatePublicProof } = require('./check-social-public-proof');

const DEFAULT_DIRECTORY = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);
const DEFAULT_CAMPAIGN_START = '2026-08-12';
const DEFAULT_CAMPAIGN_END = '2026-09-10';
const DEFAULT_HERO_PACKAGES = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/09-HERO-PACKAGES-2026-09-04-10.md',
);
const DEFAULT_PLATFORM_INVENTORY = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/PLATFORM-VIDEO-INVENTORY.md',
);

function registerDate(filename) {
  const match = filename.match(/PUBLIC-PROOF-(\d{4}-\d{2}-\d{2})\.md$/u);
  return match ? match[1] : '';
}

function nextDate(date) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  return cursor.toISOString().slice(0, 10);
}

function parseHeroYouTubeTitles(content, year = '2026') {
  const titles = new Map();
  for (const line of content.split('\n')) {
    const dateMatch = line.match(/^\| (\d{2})\/(\d{2}) \|/u);
    if (!dateMatch) continue;
    const titleMatch = line.match(/`([^`]+#Shorts)`/u);
    if (!titleMatch) continue;
    titles.set(`${year}-${dateMatch[2]}-${dateMatch[1]}`, titleMatch[1]);
  }
  return titles;
}

function proofYouTubeTitle(content) {
  const line = content.split('\n').find((candidate) => /^\| YouTube `/u.test(candidate));
  return line?.match(/\| `([^`]+#Shorts)` \|/u)?.[1] || '';
}

function executionCardDate(cardPath, content) {
  const filenameMatch = path.basename(cardPath).match(/EXECUTION-CARD-(2026-\d{2}-\d{2})\.md$/u);
  if (filenameMatch) return filenameMatch[1];

  const headingMatch = content.match(/(?:—|-)\s*(\d{1,2})\s+(août|septembre)\s+2026/iu);
  if (!headingMatch) return '';
  const month = headingMatch[2].toLocaleLowerCase('fr') === 'août' ? '08' : '09';
  return `2026-${month}-${headingMatch[1].padStart(2, '0')}`;
}

function expectedPrimaryAssets(directory) {
  const assetsByDate = new Map();
  for (const cardPath of discoverExecutionCards(directory)) {
    const content = fs.readFileSync(cardPath, 'utf8');
    const date = executionCardDate(cardPath, content);
    if (!date) throw new Error(`${path.basename(cardPath)}: date d'exécution introuvable.`);
    const assets = new Map(
      parseExecutionCard(content).map((entry) => [`C${entry.slot}`, path.basename(entry.master)]),
    );
    if (assets.size !== 3) {
      throw new Error(`${path.basename(cardPath)}: 3 masters primaires attendus.`);
    }
    if (assetsByDate.has(date)) {
      throw new Error(`Plusieurs fiches d'exécution trouvées pour ${date}.`);
    }
    assetsByDate.set(date, assets);
  }
  return assetsByDate;
}

function proofPrimaryAssets(content) {
  return new Map(
    parseTableRows(content)
      .filter((row) => /^C[123]$/u.test(row[0] || ''))
      .map((row) => [row[0], assetFromCell(row[3] || '')]),
  );
}

function pendingHeroReplacements(inventory, year = '2026') {
  const replacements = new Map();
  for (const line of inventory.split('\n')) {
    if (!/^\| `[^`]+\.mp4` \|/u.test(line) || !/À EXCLURE.*SUPPLANTÉ/u.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const dateMatch = (cells[1] || '').match(/(\d{2})\/(\d{2})/u);
    if (!dateMatch) continue;
    const date = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
    const platforms = new Set();
    for (const [platform, column] of [['X', 6], ['YouTube', 7], ['Facebook', 8]]) {
      if (/PROGRAMMÉ.*À REMPLACER/u.test(cells[column] || '')) platforms.add(platform);
    }
    if (platforms.size > 0) replacements.set(date, platforms);
  }
  return replacements;
}

function proofReplacementPlatforms(content) {
  const platforms = new Set();
  for (const row of parseTableRows(content)) {
    const isMain = /^C[123]$/u.test(row[0] || '');
    const platformCell = isMain ? row[1] : row[0];
    const statusCell = row[row.length - 2] || '';
    if (!/REMPLAC/u.test(statusCell)) continue;
    for (const platform of ['X', 'YouTube', 'Facebook']) {
      if (new RegExp(`^${platform}\\b`, 'u').test(platformCell || '')) platforms.add(platform);
    }
  }
  return platforms;
}

function validateProofDirectory(
  directory,
  today,
  campaignEnd = DEFAULT_CAMPAIGN_END,
  campaignStart = DEFAULT_CAMPAIGN_START,
  expectedYouTubeTitles = new Map(),
  expectedAssetsByDate = new Map(),
  expectedReplacementsByDate = new Map(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(today)) throw new Error(`Date --today invalide: ${today}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(campaignStart)) {
    throw new Error(`Date --campaign-start invalide: ${campaignStart}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(campaignEnd)) {
    throw new Error(`Date --campaign-end invalide: ${campaignEnd}.`);
  }
  if (campaignStart > campaignEnd) {
    throw new Error(`Fenêtre de campagne invalide: ${campaignStart} après ${campaignEnd}.`);
  }
  const files = fs.readdirSync(directory)
    .filter((file) => registerDate(file))
    .sort((left, right) => registerDate(left).localeCompare(registerDate(right)));
  if (files.length === 0) throw new Error('Aucun registre PUBLIC-PROOF daté trouvé.');

  const filesByDate = new Map();
  for (const file of files) {
    const date = registerDate(file);
    if (filesByDate.has(date)) throw new Error(`Plusieurs registres PUBLIC-PROOF pour ${date}.`);
    filesByDate.set(date, file);
  }
  for (let date = campaignStart; date <= campaignEnd; date = nextDate(date)) {
    if (!filesByDate.has(date)) throw new Error(`Registre PUBLIC-PROOF manquant pour ${date}.`);
  }
  for (const date of filesByDate.keys()) {
    if (date < campaignStart || date > campaignEnd) {
      throw new Error(`Registre PUBLIC-PROOF hors campagne: ${date}.`);
    }
  }

  let rows = 0;
  let urls = 0;
  let closed = 0;
  let open = 0;
  for (const file of files) {
    const date = registerDate(file);
    const requirePublished = date < today && date <= campaignEnd;
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    const result = validatePublicProof(content, { requirePublished });
    if (expectedAssetsByDate.has(date)) {
      const actualAssets = proofPrimaryAssets(content);
      for (const [slot, expectedAsset] of expectedAssetsByDate.get(date)) {
        const actualAsset = actualAssets.get(slot) || '';
        if (actualAsset !== expectedAsset) {
          throw new Error(
            `${file}: master ${slot} incohérent (${actualAsset || 'absent'} au lieu de ${expectedAsset}).`,
          );
        }
      }
    }
    if (expectedYouTubeTitles.has(date)) {
      const actualTitle = proofYouTubeTitle(content);
      const expectedTitle = expectedYouTubeTitles.get(date);
      if (actualTitle !== expectedTitle) {
        throw new Error(
          `${file}: titre YouTube incohérent (${actualTitle || 'absent'} au lieu de ${expectedTitle}).`,
        );
      }
    }
    if (expectedReplacementsByDate.has(date)) {
      const actualReplacements = proofReplacementPlatforms(content);
      for (const platform of expectedReplacementsByDate.get(date)) {
        if (!actualReplacements.has(platform)) {
          throw new Error(`${file}: remplacement ${platform} absent du registre public.`);
        }
      }
    }
    rows += result.rows;
    urls += result.urls;
    if (requirePublished) closed += 1;
    else open += 1;
  }
  return { files: files.length, rows, urls, closed, open };
}

function parseArguments(argv) {
  let directory = DEFAULT_DIRECTORY;
  let today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  let campaignStart = DEFAULT_CAMPAIGN_START;
  let campaignEnd = DEFAULT_CAMPAIGN_END;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--directory') directory = path.resolve(argv[++index] || '');
    else if (argv[index] === '--today') today = argv[++index] || '';
    else if (argv[index] === '--campaign-start') campaignStart = argv[++index] || '';
    else if (argv[index] === '--campaign-end') campaignEnd = argv[++index] || '';
    else throw new Error(`Option inconnue: ${argv[index]}`);
  }
  return { directory, today, campaignStart, campaignEnd };
}

function main(argv = process.argv.slice(2)) {
  const { directory, today, campaignStart, campaignEnd } = parseArguments(argv);
  const expectedYouTubeTitles = parseHeroYouTubeTitles(fs.readFileSync(DEFAULT_HERO_PACKAGES, 'utf8'));
  const expectedAssetsByDate = expectedPrimaryAssets(directory);
  const expectedReplacementsByDate = pendingHeroReplacements(
    fs.readFileSync(DEFAULT_PLATFORM_INVENTORY, 'utf8'),
  );
  const result = validateProofDirectory(
    directory,
    today,
    campaignEnd,
    campaignStart,
    expectedYouTubeTitles,
    expectedAssetsByDate,
    expectedReplacementsByDate,
  );
  process.stdout.write(
    `Social proof registers valid: ${result.files} registre(s), ${result.closed} clos, ` +
    `${result.open} ouvert(s), ${result.rows} ligne(s), ${result.urls} URL publique(s).\n`,
  );
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_CAMPAIGN_END,
  DEFAULT_CAMPAIGN_START,
  executionCardDate,
  expectedPrimaryAssets,
  nextDate,
  parseArguments,
  parseHeroYouTubeTitles,
  pendingHeroReplacements,
  proofYouTubeTitle,
  proofPrimaryAssets,
  proofReplacementPlatforms,
  registerDate,
  validateProofDirectory,
};
