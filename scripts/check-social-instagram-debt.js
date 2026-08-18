#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CARD = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/49-INSTAGRAM-PRIMARY-DEBT-CARD.md',
);
const EXPECTED_ACCOUNT = 'Instagram `@noctaliadreams`';
const PRIMARY_C1_MINUTES = 15 * 60 + 45;

function parseDate(value) {
  const match = value.match(/^(\d{2})\/(\d{2}) à (\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Date Instagram invalide : ${value}.`);
  const [, day, month, hour, minute] = match;
  return {
    day: Number(day),
    month: Number(month),
    hour: Number(hour),
    minute: Number(minute),
    timestamp: Date.UTC(2026, Number(month) - 1, Number(day), Number(hour), Number(minute)),
  };
}

function parseDebtCard(content) {
  const pathSection = content.match(/Chemins locaux exacts\s*:\s*\n([\s\S]*?)\n## Gate obligatoire/);
  if (!pathSection) throw new Error('Section des chemins locaux exacts absente.');
  const paths = [...pathSection[1].matchAll(/^- `([^`]+\.mp4)`\s*[.;]?$/gm)].map((match) => match[1]);
  const rows = content.split('\n')
    .filter((line) => /^\| \d{2}\/\d{2} à \d{2}:\d{2} \|/.test(line))
    .map((line, index) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      if (cells.length !== 6) throw new Error('Ligne de dette Instagram invalide.');
      const asset = cells[2].replaceAll('`', '');
      const sha256 = cells[3].replaceAll('`', '').toLowerCase();
      const caption = cells[4].replaceAll('`', '');
      return {
        date: cells[0],
        account: cells[1],
        asset,
        sha256,
        caption,
        status: cells[5],
        master: paths[index],
      };
    });
  if (rows.length === 0) throw new Error('Aucune dette Instagram affectée.');
  if (paths.length !== rows.length) throw new Error('Chaque dette doit avoir un chemin local exact.');
  return rows;
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

function validateDebtRows(rows, options = {}) {
  const seenAssets = new Set();
  const seenHashes = new Set();
  const ordered = [...rows].sort((left, right) => parseDate(left.date).timestamp - parseDate(right.date).timestamp);
  ordered.forEach((row, index) => {
    const parsedDate = parseDate(row.date);
    const minutes = parsedDate.hour * 60 + parsedDate.minute;
    if (row.account !== EXPECTED_ACCOUNT) throw new Error(`Compte Instagram invalide pour ${row.asset}.`);
    if (parsedDate.hour !== 12 || parsedDate.minute !== 45) throw new Error(`Créneau de dette invalide pour ${row.asset}.`);
    if (PRIMARY_C1_MINUTES - minutes < 180) throw new Error(`Collision avec C1 pour ${row.asset}.`);
    if (!row.status.includes('AFFECTÉ') || !row.status.includes('PRÊT') || !row.status.includes('NON PUBLIÉ')) {
      throw new Error(`Statut préparatoire invalide pour ${row.asset}.`);
    }
    if (!row.caption.includes('#Noctalia') || row.caption.includes('@') || /AI-generated/i.test(row.caption)) {
      throw new Error(`Légende invalide pour ${row.asset}.`);
    }
    if (!/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error(`SHA-256 absent ou invalide pour ${row.asset}.`);
    if (!row.master || path.basename(row.master) !== row.asset) throw new Error(`Chemin incohérent pour ${row.asset}.`);
    if (seenAssets.has(row.asset) || seenHashes.has(row.sha256)) throw new Error(`Dette Instagram dupliquée : ${row.asset}.`);
    seenAssets.add(row.asset);
    seenHashes.add(row.sha256);
    if (index > 0 && parsedDate.timestamp - parseDate(ordered[index - 1].date).timestamp < 7 * 24 * 60 * 60 * 1000) {
      throw new Error('Les dettes Instagram doivent être espacées d’au moins sept jours.');
    }
    if (!(options.existsSync || fs.existsSync)(row.master)) throw new Error(`Master absent : ${row.master}.`);
    const actualSha = (options.sha256File || sha256File)(row.master);
    if (actualSha !== row.sha256) throw new Error(`SHA-256 invalide pour ${row.asset}.`);
    const streams = (options.probeMedia || probeMedia)(row.master);
    const video = streams.find((stream) => stream.codec_type === 'video');
    const audio = streams.find((stream) => stream.codec_type === 'audio');
    if (!video || video.codec_name !== 'h264' || video.width !== 1080 || video.height !== 1920 || video.r_frame_rate !== '24/1') {
      throw new Error(`Vidéo Instagram non conforme : ${row.asset}.`);
    }
    if (!audio || audio.codec_name !== 'aac') throw new Error(`Audio AAC absent : ${row.asset}.`);
  });
  return ordered;
}

function main() {
  const card = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CARD;
  if (!fs.existsSync(card)) throw new Error(`Fiche de dette Instagram absente : ${card}.`);
  const rows = validateDebtRows(parseDebtCard(fs.readFileSync(card, 'utf8')));
  process.stdout.write(`Social Instagram debt valid: ${rows.length} ligne(s), cadence hebdomadaire et masters conformes.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseDate, parseDebtCard, validateDebtRows };
