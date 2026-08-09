#!/usr/bin/env node
/* global __dirname */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(ROOT_DIR, 'marketing', 'aso', 'google-play-fr-2026-08-09.json');
const LIMITS = Object.freeze({ title: 30, short_description: 80, full_description: 4000 });

function codePointLength(value) {
  return Array.from(String(value || '')).length;
}

function validateAsoSource(document) {
  const errors = [];
  const listing = document && document.listing ? document.listing : {};
  const counts = {};

  if (document.package_name !== 'com.tanuki75.noctalia') {
    errors.push('package_name doit être com.tanuki75.noctalia.');
  }
  if (document.locale !== 'fr-FR') errors.push('locale doit être fr-FR.');
  if (document.status !== 'draft') errors.push('status doit rester draft avant publication manuelle.');
  if (document.publication?.mode !== 'manual') errors.push('publication.mode doit être manual.');
  if (document.publication?.play_console_mutation_allowed !== false) {
    errors.push('publication.play_console_mutation_allowed doit être false.');
  }

  for (const [field, limit] of Object.entries(LIMITS)) {
    counts[field] = codePointLength(listing[field]);
    if (!listing[field]) errors.push(`listing.${field} est requis.`);
    else if (counts[field] > limit) {
      errors.push(`listing.${field} dépasse ${limit} caractères (${counts[field]}).`);
    }
  }

  const primaryPromise = String(document.positioning?.primary_promise || '').toLowerCase();
  if (!primaryPromise.includes('journal de rêves vivant')) {
    errors.push('La promesse principale doit contenir « journal de rêves vivant ».');
  }

  const screenshots = Array.isArray(document.screenshot_brief) ? document.screenshot_brief : [];
  if (screenshots.length < 2 || screenshots.length > 8) {
    errors.push('screenshot_brief doit contenir entre 2 et 8 captures.');
  }
  screenshots.forEach((shot, index) => {
    if (shot.order !== index + 1) errors.push(`La capture ${index + 1} a un ordre invalide.`);
    if (!shot.caption || !shot.surface || !shot.proof) {
      errors.push(`La capture ${index + 1} doit définir caption, surface et proof.`);
    }
  });

  const core = screenshots.slice(0, 3);
  if (core.some((shot) => shot.role !== 'core')) {
    errors.push('Les trois premières captures doivent porter la promesse cœur.');
  }
  if (core.some((shot) => shot.surface === 'capture' || /dict|vocal|voix|micro/i.test(shot.caption || ''))) {
    errors.push('La voix ou la capture ne doit pas diriger les trois premières captures.');
  }

  return { valid: errors.length === 0, errors, counts };
}

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--source') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Valeur manquante pour --source.');
      args.source = path.resolve(ROOT_DIR, value);
      index += 1;
    } else throw new Error(`Option inconnue : ${arg}`);
  }
  return args;
}

function checkFile(source) {
  const document = JSON.parse(fs.readFileSync(source, 'utf8'));
  return { source, ...validateAsoSource(document) };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: npm run aso:google-play:check -- [--source <fichier>] [--json]');
    return;
  }
  const result = checkFile(args.source);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Google Play FR : ${result.valid ? 'VALIDE' : 'INVALIDE'}`);
    console.log(`Titre ${result.counts.title}/${LIMITS.title} · Description courte ${result.counts.short_description}/${LIMITS.short_description} · Description longue ${result.counts.full_description}/${LIMITS.full_description}`);
    result.errors.forEach((error) => console.error(`- ${error}`));
  }
  if (!result.valid) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { DEFAULT_SOURCE, LIMITS, checkFile, codePointLength, parseArgs, validateAsoSource };
