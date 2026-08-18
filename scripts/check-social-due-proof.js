#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  isPublishedStatus,
  parseTableRows,
  validatePublicProof,
} = require('./check-social-public-proof');

const CAMPAIGN_START = '2026-08-12';
const CAMPAIGN_END = '2026-09-10';
const DEFAULT_DIRECTORY = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);

const CHECKPOINTS = [
  { row: 0, label: 'C1 TikTok', at: '16:05' },
  { row: 1, label: 'C1 Instagram', at: '16:05' },
  { row: 2, label: 'C1 X', at: '16:45' },
  { row: 3, label: 'C2 TikTok', at: '20:05' },
  { row: 4, label: 'C2 Instagram', at: '20:05' },
  { row: 5, label: 'C2 X', at: '20:45' },
  { row: 6, label: 'C3 TikTok', at: '23:05' },
  { row: 7, label: 'C3 Instagram', at: '23:05' },
  { row: 8, label: 'C3 X', at: '23:45' },
  { row: 9, label: 'Pinterest hero', at: '17:55' },
  { row: 10, label: 'YouTube hero', at: '18:15' },
  { row: 11, label: 'Facebook hero', at: '18:45' },
];

function parisParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function validateDueProof(content, now = new Date()) {
  validatePublicProof(content);
  const { date, time } = parisParts(now);
  if (date < CAMPAIGN_START || date > CAMPAIGN_END) {
    return { date, time, due: 0, published: 0, skipped: true };
  }

  const rows = parseTableRows(content);
  const due = CHECKPOINTS.filter((checkpoint) => time >= checkpoint.at);
  const missing = due.filter((checkpoint) => !isPublishedStatus(rows[checkpoint.row][rows[checkpoint.row].length - 2] || ''));
  if (missing.length > 0) {
    throw new Error(
      `Preuves publiques échues manquantes à ${time} Europe/Paris: ` +
      missing.map((checkpoint) => `${checkpoint.label} (contrôle ${checkpoint.at})`).join(', ') + '.',
    );
  }
  return { date, time, due: due.length, published: due.length, skipped: false };
}

function parseArguments(argv) {
  let directory = DEFAULT_DIRECTORY;
  let now = new Date();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--directory') {
      directory = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argv[index] === '--now') {
      now = new Date(argv[index + 1] || '');
      if (Number.isNaN(now.getTime())) throw new Error('Option --now invalide.');
      index += 1;
    } else {
      throw new Error(`Option inconnue: ${argv[index]}`);
    }
  }
  return { directory, now };
}

function main(argv = process.argv.slice(2)) {
  const { directory, now } = parseArguments(argv);
  const { date } = parisParts(now);
  if (date < CAMPAIGN_START || date > CAMPAIGN_END) {
    process.stdout.write(`Social due proof skipped: ${date} hors campagne.\n`);
    return;
  }
  const matches = fs.readdirSync(directory).filter((name) =>
    name.endsWith(`PUBLIC-PROOF-${date}.md`)
  );
  if (matches.length !== 1) {
    throw new Error(`Un registre PUBLIC-PROOF attendu pour ${date}, ${matches.length} trouvé(s).`);
  }
  const result = validateDueProof(fs.readFileSync(path.join(directory, matches[0]), 'utf8'), now);
  process.stdout.write(
    `Social due proof valid: ${result.date} ${result.time} Europe/Paris, ` +
    `${result.published}/${result.due} preuve(s) échue(s).\n`,
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

module.exports = { CHECKPOINTS, parisParts, parseArguments, validateDueProof };
