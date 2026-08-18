#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_DIR = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);
const DEFAULT_INVENTORY = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/PLATFORM-VIDEO-INVENTORY.md',
);

function discoverArchiveCards(directory = ARCHIVE_DIR) {
  return fs.readdirSync(directory)
    .filter((file) => /^\d+-ARCHIVE-(?:PILOT-)?CARD-.*\.md$/.test(file))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
    .map((file) => path.join(directory, file));
}

function parseArchiveCard(content) {
  const master = content.match(/- chemin durable\s*:\s*\n\s*`([^`]+)`/);
  const sha = content.match(/- SHA-256\s*:\s*\n\s*`([a-f0-9]{64})`/i);
  if (!master || !sha) throw new Error('Chemin durable ou SHA-256 manquant.');
  return { master: master[1], sha256: sha[1].toLowerCase() };
}

function validateArchivePackaging(content, basename) {
  for (const platform of ['YouTube Shorts', 'Facebook Reels', 'Pinterest']) {
    if (!content.includes(`| ${platform} |`)) throw new Error(`${basename}: package ${platform} absent.`);
  }
  if (!/12:30/u.test(content)) throw new Error(`${basename}: horaire archive 12:30 absent.`);
  if (!/#Noctalia/u.test(content)) throw new Error(`${basename}: hashtag Noctalia absent des packages.`);
  if (!/utm_source=pinterest/u.test(content)) throw new Error(`${basename}: destination UTM Pinterest absente.`);
  if (!/(?:dette|cadence) HERO[\s\S]{0,160}`?10 %`?/iu.test(content) &&
      !/heroes en dette/iu.test(content)) {
    throw new Error(`${basename}: gate de dette HERO absente.`);
  }
  if (!/anti-doublon|absence d.URL|jamais été publi/iu.test(content)) {
    throw new Error(`${basename}: contrôle anti-doublon absent.`);
  }
}

function parseFirstWaveAssets(content) {
  const start = content.indexOf('### Première vague prioritaire');
  const end = content.indexOf('### Packaging natif du pilote archive', start);
  if (start < 0 || end < 0) throw new Error('Première vague prioritaire introuvable dans l’inventaire.');
  return content.slice(start, end).split('\n')
    .filter((line) => /^\| \d+ \| `[^`]+\.mp4` \|/u.test(line))
    .map((line) => line.match(/^\| \d+ \| `([^`]+\.mp4)` \|/u)[1]);
}

function validateArchiveSelection(cards, inventory, expectedCount = 6) {
  const selected = cards.map((card) => path.basename(parseArchiveCard(fs.readFileSync(card, 'utf8')).master));
  const expected = parseFirstWaveAssets(inventory).slice(0, expectedCount);
  if (expected.length !== expectedCount) throw new Error(`Première vague incomplète : ${expected.length}/${expectedCount}.`);
  const selectedSet = new Set(selected);
  if (selected.length !== expectedCount || expected.some((asset) => !selectedSet.has(asset))) {
    throw new Error(`Cartes archive hors priorité : ${selected.join(', ')} au lieu de ${expected.join(', ')}.`);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function probeMedia(filePath) {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' })).streams || [];
}

function validateArchiveCards(cards, options = {}) {
  const seen = new Set();
  const results = [];
  for (const card of cards) {
    const content = fs.readFileSync(card, 'utf8');
    const entry = parseArchiveCard(content);
    const basename = path.basename(entry.master);
    validateArchivePackaging(content, basename);
    if (seen.has(basename)) throw new Error(`Archive dupliquée : ${basename}.`);
    seen.add(basename);
    if (!fs.existsSync(entry.master)) throw new Error(`Master absent : ${entry.master}.`);
    const actualSha = (options.sha256File || sha256File)(entry.master);
    if (actualSha !== entry.sha256) throw new Error(`SHA-256 invalide pour ${basename}.`);
    const streams = (options.probeMedia || probeMedia)(entry.master);
    const video = streams.find((stream) => stream.codec_type === 'video');
    const audio = streams.find((stream) => stream.codec_type === 'audio');
    if (!video || video.codec_name !== 'h264' || video.width >= video.height || video.r_frame_rate !== '24/1') {
      throw new Error(`Vidéo archive non conforme : ${basename}.`);
    }
    if (!audio || audio.codec_name !== 'aac') throw new Error(`Audio AAC absent : ${basename}.`);
    results.push({ card, ...entry });
  }
  return results;
}

function main(argv = process.argv.slice(2)) {
  const cards = discoverArchiveCards();
  if (cards.length === 0) throw new Error('Aucune carte archive trouvée.');
  const inventory = fs.readFileSync(path.resolve(argv[0] || DEFAULT_INVENTORY), 'utf8');
  validateArchiveSelection(cards, inventory);
  const checked = validateArchiveCards(cards);
  process.stdout.write(`Social archive preflight valid: ${checked.length} carte(s), ${checked.length} master(s) unique(s).\n`);
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
  discoverArchiveCards,
  parseArchiveCard,
  parseFirstWaveAssets,
  validateArchiveCards,
  validateArchivePackaging,
  validateArchiveSelection,
};
