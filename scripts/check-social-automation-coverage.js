#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const AUTOMATIONS_DIR = path.join(os.homedir(), '.codex/automations');
const DEFAULT_MAIN = path.join(AUTOMATIONS_DIR, 'noctalia-tiktok-programmation-roulante-ao-t/automation.toml');
const DEFAULT_SECONDARY = path.join(AUTOMATIONS_DIR, 'noctalia-extension-organique-contr-le-roulant/automation.toml');
const DEFAULT_COVERAGE = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/08-COVERAGE-AND-ROLLING-REFILL.md',
);

function tomlString(content, key) {
  const match = content.match(new RegExp(`^${key} = "((?:\\\\.|[^"\\\\])*)"$`, 'mu'));
  return match ? JSON.parse(`"${match[1]}"`) : '';
}

function triggers(content) {
  const rule = tomlString(content, 'rrule');
  const hours = rule.match(/BYHOUR=([^;]+)/u)?.[1].split(',').map(Number) || [];
  const minutes = rule.match(/BYMINUTE=([^;]+)/u)?.[1].split(',').map(Number) || [];
  return new Set(hours.flatMap((hour) => minutes.map((minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)));
}

function requireTriggers(actual, expected, label) {
  for (const time of expected) {
    if (!actual.has(time)) throw new Error(`${label}: réveil ${time} manquant.`);
  }
}

function heroCounts(coverage) {
  const result = {};
  for (const platform of ['Pinterest', 'YouTube', 'Facebook']) {
    const match = coverage.match(new RegExp(`${platform}[^\\n]*\\*\\*(\\d+)\\/28 heroes exacts\\*\\*`, 'iu'));
    if (!match) throw new Error(`${platform}: compteur HERO absent de la couverture.`);
    result[platform] = Number(match[1]);
  }
  return result;
}

function primaryCounts(coverage) {
  const patterns = {
    TikTok: /TikTok[^\n]*\*\*(\d+)\/84 lignes exactes\*\*/iu,
    Instagram: /Instagram[^\n]*\*\*(\d+)\/84 lignes couvertes\*\*/iu,
    X: /X `@NoctaliaDreams`[^\n]*\*\*(\d+)\/84 lignes exactes\*\*/iu,
  };
  const result = {};
  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = coverage.match(pattern);
    if (!match) throw new Error(`${platform}: compteur principal absent de la couverture.`);
    result[platform] = Number(match[1]);
  }
  return result;
}

function validateAutomationCoverage(main, secondary, coverage) {
  for (const [label, content] of [['Principale', main], ['Secondaire', secondary]]) {
    if (tomlString(content, 'status') !== 'ACTIVE') throw new Error(`${label}: automation inactive.`);
    if (!tomlString(content, 'target_thread_id')) throw new Error(`${label}: thread cible absent.`);
    if (tomlString(content, 'notification_policy') !== 'failed_runs_only') {
      throw new Error(`${label}: politique de notification inattendue.`);
    }
  }

  const mainTriggers = triggers(main);
  const secondaryTriggers = triggers(secondary);
  requireTriggers(mainTriggers, ['12:25', '12:45', '15:25', '15:45', '16:25', '19:25', '19:45', '20:25', '22:25', '22:45', '23:25'], 'Principale');
  requireTriggers(secondaryTriggers, ['10:45', '17:05', '17:45', '18:05', '18:45'], 'Secondaire');

  const overlaps = [...mainTriggers].filter((time) => secondaryTriggers.has(time));
  if (overlaps.length > 0) throw new Error(`Chevauchement entre automations : ${overlaps.join(', ')}.`);

  const mainPrompt = tomlString(main, 'prompt');
  const secondaryPrompt = tomlString(secondary, 'prompt');
  const counts = heroCounts(coverage);
  const primary = primaryCounts(coverage);
  for (const [label, prompt] of [['Principale', mainPrompt], ['Secondaire', secondaryPrompt]]) {
    if (!/npm run social:health/u.test(prompt) || !/social:proof:due/u.test(prompt)) {
      throw new Error(`${label}: contrôle temporel social:health / social:proof:due absent du prompt.`);
    }
  }
  for (const [pattern, message] of [
    [/Cadence principale Europe\/Paris/iu, 'cadence principale absente'],
    [/DreamViews d'abord/iu, 'ordre DreamViews absent'],
    [/Reddit seulement après trois contributions DreamViews/iu, 'gate Reddit absent'],
    [/file du programme courant est complète et vérifiée jusqu'au 10\/09/iu, 'état X absent'],
  ]) {
    if (!pattern.test(mainPrompt)) throw new Error(`Principale : ${message}.`);
  }
  for (const platform of ['TikTok', 'Instagram', 'X']) {
    if (!new RegExp(`${platform} ${primary[platform]}\/84`, 'iu').test(mainPrompt)) {
      throw new Error(`Principale : compteur ${platform} désynchronisé de la couverture.`);
    }
  }
  for (const [pattern, message] of [
    [/À 10:45/iu, 'reprise YouTube 10:45 absente'],
    [/Pinterest 17:30, YouTube 18:00, Facebook 18:15/iu, 'horaires HERO absents'],
    [/Pinterest a également une dette HERO supérieure à 10 %/iu, 'gate archive Pinterest absente'],
  ]) {
    if (!pattern.test(secondaryPrompt)) throw new Error(`Secondaire : ${message}.`);
  }
  for (const platform of ['Pinterest', 'YouTube', 'Facebook']) {
    if (!new RegExp(`${platform} couvre ${counts[platform]}\\/28 HERO exacts`, 'iu').test(secondaryPrompt)) {
      throw new Error(`Secondaire : compteur ${platform} désynchronisé de la couverture.`);
    }
  }

  return { main: mainTriggers.size, secondary: secondaryTriggers.size, overlaps: overlaps.length, heroCounts: counts, primaryCounts: primary };
}

function main(argv = process.argv.slice(2)) {
  const mainPath = path.resolve(argv[0] || DEFAULT_MAIN);
  const secondaryPath = path.resolve(argv[1] || DEFAULT_SECONDARY);
  const coveragePath = path.resolve(argv[2] || DEFAULT_COVERAGE);
  const result = validateAutomationCoverage(
    fs.readFileSync(mainPath, 'utf8'),
    fs.readFileSync(secondaryPath, 'utf8'),
    fs.readFileSync(coveragePath, 'utf8'),
  );
  process.stdout.write(
    `Social automation coverage valid: ${result.main} passages principaux, ${result.secondary} secondaires, ` +
    `${result.overlaps} chevauchement, principal ${result.primaryCounts.TikTok}/${result.primaryCounts.Instagram}/${result.primaryCounts.X}, ` +
    `HERO ${result.heroCounts.Pinterest}/${result.heroCounts.YouTube}/${result.heroCounts.Facebook}.\n`,
  );
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { heroCounts, primaryCounts, tomlString, triggers, validateAutomationCoverage };
