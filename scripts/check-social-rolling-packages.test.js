'use strict';
/* global describe, expect, it */

const { blockedMasters, packageRows, validateRollingPackages } = require('./check-social-rolling-packages');

const inventory = [
  '| Asset | Usage | Statut |',
  '|---|---|---|',
  '| `good.mp4` | HERO | PRÊT |',
  '| `bad.mp4` | HERO | **À EXCLURE JUSQU\'À CORRECTION** — **BLOQUÉ QA** |',
].join('\n');

const goodRow = '| 24/08 | `/repo/good.mp4` ; `abc` | **Ready** | Board |';
const blockedRow = '| 30/08 | `/repo/bad.mp4` ; `def` | **BLOQUÉ QA — NE PAS PROGRAMMER** | Board |';

describe('social rolling package guard', () => {
  it('extracts blocked inventory masters', () => {
    expect([...blockedMasters(inventory)]).toEqual(['bad.mp4']);
  });

  it('extracts dated package rows and basenames', () => {
    expect(packageRows(`${goodRow}\n${blockedRow}`).map((row) => row.master)).toEqual(['good.mp4', 'bad.mp4']);
  });

  it('accepts an explicitly blocked package and global status', () => {
    expect(validateRollingPackages(inventory, `Statut global : **1 PRÊT ; 1 BLOQUÉ QA**.\n${goodRow}\n${blockedRow}`))
      .toEqual({ blocked: 1, packages: 2 });
  });

  it('rejects a blocked master presented as ready', () => {
    expect(() => validateRollingPackages(inventory, `Statut global : **PRÊTS**.\n${goodRow}\n${blockedRow.replace('BLOQUÉ QA — NE PAS PROGRAMMER', 'Ready')}`))
      .toThrow('BLOQUÉ QA');
  });

  it('rejects a misleading global status', () => {
    expect(() => validateRollingPackages(inventory, `Statut global : **PRÊTS**.\n${goodRow}\n${blockedRow}`))
      .toThrow('statut global');
  });
});
