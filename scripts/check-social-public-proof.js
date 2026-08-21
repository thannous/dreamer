#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = [
  ['C1', 'TikTok', '15:30'],
  ['C1', 'Instagram', '15:45'],
  ['C1', 'X', '16:15'],
  ['C2', 'TikTok', '19:30'],
  ['C2', 'Instagram', '19:45'],
  ['C2', 'X', '20:15'],
  ['C3', 'TikTok', '22:30'],
  ['C3', 'Instagram', '22:45'],
  ['C3', 'X', '23:15'],
  ['', 'Pinterest', '17:30'],
  ['', 'YouTube', '18:00'],
  ['', 'Facebook', '18:15'],
];

const PLATFORM_HOSTS = {
  TikTok: ['tiktok.com'],
  Instagram: ['instagram.com'],
  X: ['x.com', 'twitter.com'],
  Pinterest: ['pinterest.com'],
  YouTube: ['youtube.com', 'youtu.be'],
  Facebook: ['facebook.com'],
};

const PLATFORM_ACCOUNTS = {
  TikTok: '@noctaliadreams',
  Instagram: '@noctaliadreams',
  X: '@NoctaliaDreams',
  Pinterest: '@noctaliadreams',
  YouTube: 'UCQZsVAOggq_meTWYG-4dHfw',
  Facebook: '1266183263247451',
};

const ACCOUNT_PATH_PATTERNS = {
  TikTok: /^\/@noctaliadreams\/video\/[^/]+\/?$/iu,
  Instagram: /^\/noctaliadreams\/reel\/[^/]+\/?$/iu,
  X: /^\/NoctaliaDreams\/status\/[^/]+\/?$/iu,
};

function parseTableRows(content) {
  return content
    .split('\n')
    .filter((line) => /^\| (?:C[123] \| |(?:Pinterest|YouTube|Facebook) )/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function platformFromCell(cell) {
  const match = cell.match(/^(TikTok|Instagram|X|Pinterest|YouTube|Facebook)\b/);
  return match ? match[1] : '';
}

function urlFromCell(cell) {
  const markdown = cell.match(/\[[^\]]+\]\((https:\/\/[^)]+)\)/);
  if (markdown) return markdown[1];
  const plain = cell.match(/https:\/\/[^\s<>)]+/);
  return plain ? plain[0].replace(/[.;,]+$/, '') : '';
}

function isPublishedStatus(cell) {
  return !/(?:ÉCHEC|NON\s+PUBLIÉ)/iu.test(cell) && /PUBLI(?:É|ÉE)/iu.test(cell);
}

function isTerminalFailureStatus(cell) {
  return /^\s*\*\*ÉCHEC\s+—\s+NON\s+PUBLIÉ\*\*(?:\s+—\s+.*)?$/iu.test(cell);
}

function assetFromCell(cell) {
  const match = cell.match(/`([^`]+\.mp4)`/u);
  return match ? path.basename(match[1]) : '';
}

function declaredHeroAsset(content) {
  const match = content.match(/Le hero(?: secondaire)? reprend `([^`]+\.mp4)`/iu);
  return match ? path.basename(match[1]) : '';
}

function hostMatchesPlatform(url, platform) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function urlMatchesAccount(url, platform) {
  const pattern = ACCOUNT_PATH_PATTERNS[platform];
  if (!pattern) return true;
  return pattern.test(new URL(url).pathname);
}

function parseArguments(argv) {
  let requirePublished = false;
  const files = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--require-published') {
      requirePublished = true;
      continue;
    }
    if (argument === '--file') {
      const file = argv[index + 1];
      if (!file || file.startsWith('--')) {
        throw new Error('Option --file: chemin de registre manquant.');
      }
      files.push(file);
      index += 1;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new Error(`Option inconnue: ${argument}`);
    }
    files.push(argument);
  }

  return { requirePublished, files };
}

function validatePublicProof(content, options = {}) {
  const requirePublished = Boolean(options.requirePublished);
  const rows = parseTableRows(content);
  if (rows.length !== 12) {
    throw new Error(`12 lignes de preuve attendues, ${rows.length} trouvées.`);
  }

  const urls = [];
  let terminalFailures = 0;
  const primaryAssets = new Map();
  const heroAsset = declaredHeroAsset(content);
  if (!heroAsset) throw new Error('Asset MP4 du hero secondaire non déclaré.');
  for (let index = 0; index < EXPECTED.length; index += 1) {
    const [expectedSlot, expectedPlatform, expectedTime] = EXPECTED[index];
    const row = rows[index];
    const isMain = row[0]?.startsWith('C');
    const slot = isMain ? row[0] : '';
    const platformCell = isMain ? row[1] : row[0];
    const time = isMain ? row[2] : row[1];
    const proofCell = row[row.length - 1] || '';
    const statusCell = row[row.length - 2] || '';
    const platform = platformFromCell(platformCell);

    if (slot !== expectedSlot || platform !== expectedPlatform || time !== expectedTime) {
      throw new Error(
        `Ligne ${index + 1}: attendu ${expectedSlot || 'HERO'} ${expectedPlatform} ${expectedTime}, ` +
        `trouvé ${slot || 'HERO'} ${platform || 'plateforme absente'} ${time || 'heure absente'}.`,
      );
    }
    const expectedAccount = PLATFORM_ACCOUNTS[expectedPlatform];
    if (!platformCell.includes(expectedAccount)) {
      throw new Error(
        `Ligne ${index + 1}: compte exact ${expectedAccount} manquant pour ${expectedPlatform}.`,
      );
    }
    if (isMain) {
      const asset = assetFromCell(row[3] || '');
      if (!asset) throw new Error(`Ligne ${index + 1}: asset MP4 exact manquant pour ${expectedPlatform}.`);
      if (primaryAssets.has(slot) && primaryAssets.get(slot) !== asset) {
        throw new Error(`Créneau ${slot}: assets différents entre TikTok, Instagram et X.`);
      }
      primaryAssets.set(slot, asset);
    }

    const url = urlFromCell(proofCell);
    const published = isPublishedStatus(statusCell);
    const terminalFailure = isTerminalFailureStatus(statusCell);
    if (/\bPUBLIC\b/iu.test(statusCell) && !published) {
      throw new Error(
        `Ligne ${index + 1}: statut PUBLIC ambigu sans preuve PUBLIÉ pour ${expectedPlatform}.`,
      );
    }
    if (url && terminalFailure) {
      throw new Error(`Ligne ${index + 1}: état ÉCHEC — NON PUBLIÉ incompatible avec une URL publique pour ${expectedPlatform}.`);
    }
    if (url && !published) {
      throw new Error(`Ligne ${index + 1}: URL publique présente sans statut PUBLIÉ pour ${expectedPlatform}.`);
    }
    if (published && !url) {
      throw new Error(`Ligne ${index + 1}: statut PUBLIÉ sans URL publique HTTPS pour ${expectedPlatform}.`);
    }
    if (requirePublished && !published && !terminalFailure) {
      throw new Error(`Ligne ${index + 1}: statut PUBLIÉ manquant (sauf ÉCHEC — NON PUBLIÉ terminal) pour ${expectedPlatform}.`);
    }
    if (requirePublished && !url && !terminalFailure) {
      throw new Error(`Ligne ${index + 1}: URL publique HTTPS manquante pour ${expectedPlatform}.`);
    }
    if (url && !hostMatchesPlatform(url, expectedPlatform)) {
      throw new Error(`Ligne ${index + 1}: domaine de preuve invalide pour ${expectedPlatform}.`);
    }
    if (url && !urlMatchesAccount(url, expectedPlatform)) {
      throw new Error(
        `Ligne ${index + 1}: URL publique hors du compte Noctalia exact pour ${expectedPlatform}.`,
      );
    }
    if (url) urls.push(url);
    if (terminalFailure) terminalFailures += 1;
  }

  if (new Set(urls).size !== urls.length) {
    throw new Error('Une URL publique est dupliquée entre plusieurs lignes.');
  }
  if (primaryAssets.get('C1') !== heroAsset) {
    throw new Error('Le hero secondaire doit reprendre exactement le master MP4 du créneau C1.');
  }
  if (requirePublished && urls.length + terminalFailures !== 12) {
    throw new Error(`12 états terminaux attendus, ${urls.length + terminalFailures} trouvés.`);
  }

  return { rows: rows.length, urls: urls.length };
}

function main(argv = process.argv.slice(2)) {
  const { requirePublished, files } = parseArguments(argv);
  if (files.length === 0) {
    throw new Error(
      'Usage: node scripts/check-social-public-proof.js [--require-published] [--file] <registre.md> [...]',
    );
  }

  let rows = 0;
  let urls = 0;
  for (const file of files) {
    const result = validatePublicProof(fs.readFileSync(path.resolve(file), 'utf8'), { requirePublished });
    rows += result.rows;
    urls += result.urls;
  }
  process.stdout.write(
    `Social public proof ${requirePublished ? 'closure' : 'structure'} valid: ` +
    `${files.length} registre(s), ${rows} ligne(s), ${urls} URL publique(s).\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  assetFromCell,
  declaredHeroAsset,
  hostMatchesPlatform,
  isPublishedStatus,
  isTerminalFailureStatus,
  parseArguments,
  parseTableRows,
  urlMatchesAccount,
  validatePublicProof,
};
