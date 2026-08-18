#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/PLATFORM-VIDEO-INVENTORY.md',
);
const PACKAGES = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/12-PINTEREST-ROLLING-PACKAGES-2026-08-24-09-02.md',
);

function blockedMasters(inventory) {
  return new Set(
    inventory
      .split('\n')
      .filter((line) => /^\| `[^`]+\.mp4` \|/.test(line) && /BLOQUÉ QA|À EXCLURE JUSQU'À CORRECTION/.test(line))
      .map((line) => line.match(/^\| `([^`]+\.mp4)` \|/)?.[1])
      .filter(Boolean),
  );
}

function packageRows(packages) {
  return packages
    .split('\n')
    .filter((line) => /^\| \d{2}\/\d{2} \|/.test(line))
    .map((line) => ({
      line,
      master: line.match(/\/([^/`]+\.mp4)`/)?.[1],
    }));
}

function validateRollingPackages(inventory, packages) {
  const blocked = blockedMasters(inventory);
  const rows = packageRows(packages);
  if (rows.length === 0) throw new Error('Aucune ligne de package roulant trouvée.');

  const blockedRows = rows.filter(({ master }) => master && blocked.has(master));
  for (const { line, master } of blockedRows) {
    if (!/BLOQUÉ QA/.test(line) || !/NE PAS PROGRAMMER/.test(line)) {
      throw new Error(`Master bloqué ${master}: la ligne doit indiquer BLOQUÉ QA — NE PAS PROGRAMMER.`);
    }
  }

  const globalStatus = packages.match(/^Statut global\s*:\s*(.+)$/m)?.[1] || '';
  if (blockedRows.length > 0 && !/BLOQUÉ QA/.test(globalStatus)) {
    throw new Error('Le statut global doit signaler les packages BLOQUÉ QA.');
  }

  return { blocked: blockedRows.length, packages: rows.length };
}

function main() {
  const result = validateRollingPackages(
    fs.readFileSync(INVENTORY, 'utf8'),
    fs.readFileSync(PACKAGES, 'utf8'),
  );
  process.stdout.write(
    `Social rolling packages valid: ${result.packages} package(s), ${result.blocked} bloqué(s) explicitement.\n`,
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

module.exports = { blockedMasters, packageRows, validateRollingPackages };
