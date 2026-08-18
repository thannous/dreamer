#!/usr/bin/env node
'use strict';
/* global __dirname */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXECUTION_DIR = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);

function discoverExecutionCards(directory = EXECUTION_DIR) {
  const datedCards = fs.readdirSync(directory)
    .filter((file) => /^\d+-EXECUTION-CARD-2026-\d{2}-\d{2}\.md$/.test(file))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
    .map((file) => path.join(directory, file));

  return [
    path.join(directory, '06-TODAY-EXECUTION-CARD.md'),
    path.join(directory, '07-NEXT-DAY-EXECUTION-CARD.md'),
    ...datedCards,
  ].filter((file) => fs.existsSync(file));
}

function parseExecutionCard(content) {
  const sectionEntries = content
    .split(/^## Créneau \d+\s*$/m)
    .slice(1)
    .map((section, index) => {
      const master = section.match(/- Master(?: Instagram)? durable\s*:\s*\n\s*`([^`]+)`\./);
      const sha = section.match(/- SHA-256\s*:\s*\n\s*`([a-f0-9]{64})`\./i);
      const caption = section.match(/- Légende(?: Instagram)? exacte[^\n]*:\s*\n\s*```text\n([\s\S]*?)\n```/);

      if (!master || !sha || !caption) {
        throw new Error(`Créneau ${index + 1}: master, SHA-256 ou légende exacte manquant.`);
      }

      return {
        caption: caption[1].trim(),
        master: master[1],
        sha256: sha[1].toLowerCase(),
        slot: index + 1,
      };
    });

  if (sectionEntries.length > 0) return sectionEntries;

  const tableRows = content.split('\n').filter((line) => /^\| [123] \|/.test(line));
  const durableDir = content.match(/`(output\/video\/noctalia-social-execution-[^/`]+\/)`/);
  if (tableRows.length === 0) return [];

  return tableRows.map((row, index) => {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    const masterCell = cells[1]?.match(/`([^`]+\.mp4)`/);
    const sha = cells[2]?.match(/`([a-f0-9]{64})`/i);
    const caption = cells[6]?.match(/`([^`]+)`/);
    if (!masterCell || !sha || !caption) {
      throw new Error(`Créneau ${index + 1}: ligne de tableau incomplète.`);
    }
    const master = masterCell[1].startsWith('output/')
      ? masterCell[1]
      : durableDir
        ? `${durableDir[1]}${masterCell[1]}`
        : '';
    if (!master) throw new Error(`Créneau ${index + 1}: dossier durable introuvable.`);
    return {
      caption: caption[1].trim(),
      master,
      sha256: sha[1].toLowerCase(),
      slot: Number(cells[0]),
    };
  });
}

function validateCaption(caption, slot) {
  if (!caption.startsWith(caption.trim()) || !caption.endsWith(caption.trim())) {
    throw new Error(`Créneau ${slot}: espaces superflus dans la légende.`);
  }
  if (!caption.includes('#Noctalia')) {
    throw new Error(`Créneau ${slot}: #Noctalia absent de la légende.`);
  }
  if (/@\w/.test(caption)) {
    throw new Error(`Créneau ${slot}: @mention interdite dans la légende.`);
  }
  if (/AI-generated/i.test(caption)) {
    throw new Error(`Créneau ${slot}: texte AI-generated interdit dans la légende.`);
  }
  if (/[^\x00-\x7F]/.test(caption)) {
    throw new Error(`Créneau ${slot}: la légende doit rester en ASCII anglais.`);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function probeMedia(filePath) {
  const output = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  return JSON.parse(output).streams || [];
}

function validateMedia(streams, slot) {
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');

  if (!video || video.codec_name !== 'h264') {
    throw new Error(`Créneau ${slot}: flux vidéo H.264 absent.`);
  }
  if (video.width >= video.height) {
    throw new Error(`Créneau ${slot}: le master n'est pas vertical.`);
  }
  if (video.r_frame_rate !== '24/1') {
    throw new Error(`Créneau ${slot}: cadence ${video.r_frame_rate || 'absente'} au lieu de 24 fps.`);
  }
  if (!audio || audio.codec_name !== 'aac') {
    throw new Error(`Créneau ${slot}: flux audio AAC absent.`);
  }
}

function validateExecutionCard(cardPath, options = {}) {
  const rootDir = options.rootDir || ROOT;
  const entries = parseExecutionCard(fs.readFileSync(cardPath, 'utf8'));
  if (entries.length !== 3) {
    throw new Error(`${path.basename(cardPath)}: 3 créneaux attendus, ${entries.length} trouvés.`);
  }

  const seenMasters = new Set();
  for (const entry of entries) {
    validateCaption(entry.caption, entry.slot);
    if (seenMasters.has(entry.master)) {
      throw new Error(`Créneau ${entry.slot}: master dupliqué dans la journée.`);
    }
    seenMasters.add(entry.master);

    const filePath = path.resolve(rootDir, entry.master);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Créneau ${entry.slot}: master absent: ${filePath}`);
    }
    const actualSha = (options.sha256File || sha256File)(filePath);
    if (actualSha !== entry.sha256) {
      throw new Error(`Créneau ${entry.slot}: SHA-256 ${actualSha} différent de ${entry.sha256}.`);
    }
    validateMedia((options.probeMedia || probeMedia)(filePath), entry.slot);
  }

  return entries;
}

function validateExecutionCards(cardPaths, options = {}) {
  const entries = [];
  const seenMasters = new Map();

  for (const cardPath of cardPaths) {
    for (const entry of validateExecutionCard(cardPath, options)) {
      const masterKey = path.basename(entry.master);
      const previous = seenMasters.get(masterKey);
      if (previous) {
        throw new Error(
          `Master ${masterKey} réutilisé dans ${path.basename(previous.cardPath)} créneau ${previous.slot} ` +
          `et ${path.basename(cardPath)} créneau ${entry.slot}.`,
        );
      }
      seenMasters.set(masterKey, { cardPath, slot: entry.slot });
      entries.push(entry);
    }
  }

  return entries;
}

function main(argv = process.argv.slice(2)) {
  const cards = argv.length > 0
    ? argv.map((card) => path.resolve(ROOT, card))
    : discoverExecutionCards();
  if (cards.length === 0) throw new Error('Aucune fiche d’exécution trouvée.');
  let checked;
  try {
    checked = validateExecutionCards(cards).length;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
  process.stdout.write(`Social execution preflight valid: ${cards.length} fiche(s), ${checked} créneaux.\n`);
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
  discoverExecutionCards,
  parseExecutionCard,
  validateCaption,
  validateExecutionCard,
  validateExecutionCards,
  validateMedia,
};
