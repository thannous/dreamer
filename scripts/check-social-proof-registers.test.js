'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  executionCardDate,
  nextDate,
  parseHeroYouTubeTitles,
  pendingHeroReplacements,
  proofYouTubeTitle,
  proofPrimaryAssets,
  proofReplacementPlatforms,
  registerDate,
  validateProofDirectory,
} = require('./check-social-proof-registers');

const platforms = [
  ['C1', 'TikTok', '15:30', 'www.tiktok.com'], ['C1', 'Instagram', '15:45', 'www.instagram.com'],
  ['C1', 'X', '16:15', 'x.com'], ['C2', 'TikTok', '19:30', 'www.tiktok.com'],
  ['C2', 'Instagram', '19:45', 'www.instagram.com'], ['C2', 'X', '20:15', 'x.com'],
  ['C3', 'TikTok', '22:30', 'www.tiktok.com'], ['C3', 'Instagram', '22:45', 'www.instagram.com'],
  ['C3', 'X', '23:15', 'x.com'],
];
const heroes = [['Pinterest', '17:30', 'pinterest.com'], ['YouTube', '18:00', 'youtube.com'], ['Facebook', '18:15', 'facebook.com']];
const accounts = {
  TikTok: '@noctaliadreams',
  Instagram: '@noctaliadreams',
  X: '@NoctaliaDreams',
  Pinterest: '@noctaliadreams',
  YouTube: 'UCQZsVAOggq_meTWYG-4dHfw',
  Facebook: '1266183263247451',
};

function proofUrl(platform, host, index, kind) {
  if (platform === 'TikTok') return `https://${host}/@noctaliadreams/video/${kind}${index}`;
  if (platform === 'Instagram') return `https://${host}/noctaliadreams/reel/${kind}${index}/`;
  if (platform === 'X') return `https://${host}/NoctaliaDreams/status/${kind}${index}`;
  return `https://${host}/${kind}-${index}`;
}

function register(published, failedRows = []) {
  const failures = new Set(failedRows);
  const primary = platforms.map(([slot, platform, time, host], index) =>
    `| ${slot} | ${platform} \`${accounts[platform]}\` | ${time} | \`asset-${slot}.mp4\` | **${failures.has(index) ? 'ÉCHEC — NON PUBLIÉ' : published ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${published && !failures.has(index) ? `[URL](${proofUrl(platform, host, index, 'main')})` : 'À vérifier'} |`);
  const secondary = heroes.map(([platform, time, host], index) =>
    `| ${platform} \`${accounts[platform]}\` | ${time} | Hero | **${failures.has(index + 9) ? 'ÉCHEC — NON PUBLIÉ' : published ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${published && !failures.has(index + 9) ? `[URL](${proofUrl(platform, host, index, 'hero')})` : 'À vérifier'} |`);
  return `Le hero secondaire reprend \`asset-C1.mp4\`.\n\n${[...primary, ...secondary].join('\n')}`;
}

describe('dated social proof registers', () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'social-proof-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('extracts dates only from dated proof registers', () => {
    expect(registerDate('36-TODAY-PUBLIC-PROOF-2026-08-13.md')).toBe('2026-08-13');
    expect(registerDate('README.md')).toBe('');
    expect(nextDate('2026-08-31')).toBe('2026-09-01');
  });

  it('extracts execution dates and primary assets for exact reconciliation', () => {
    expect(executionCardDate(
      '/tmp/07-NEXT-DAY-EXECUTION-CARD.md',
      '# Fiche d’exécution ACTIVE — 14 août 2026',
    )).toBe('2026-08-14');
    expect(executionCardDate('/tmp/10-EXECUTION-CARD-2026-08-15.md', '')).toBe('2026-08-15');
    expect([...proofPrimaryAssets(register(false))]).toEqual([
      ['C1', 'asset-C1.mp4'],
      ['C2', 'asset-C2.mp4'],
      ['C3', 'asset-C3.mp4'],
    ]);
  });

  it('reconciles pending replacement platforms from inventory and proof register', () => {
    const row = '| `old.mp4` | ANCIEN HERO 30/08 C1 | **À EXCLURE — SUPPLANTÉ** | — | — | — | **PROGRAMMÉ — À REMPLACER** | **PROGRAMMÉ — À REMPLACER** | **PROGRAMMÉ — À REMPLACER** | — | Supplanté. |';
    expect([...pendingHeroReplacements(row).get('2026-08-30')]).toEqual(['X', 'YouTube', 'Facebook']);
    const proof = register(false)
      .replace('| C1 | X `@NoctaliaDreams` | 16:15 | `asset-C1.mp4` | **PROGRAMMÉ** |', '| C1 | X `@NoctaliaDreams` | 16:15 | `asset-C1.mp4` | **PRÊT — REMPLACEMENT NON PROGRAMMÉ** |')
      .replace('| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | Hero | **PROGRAMMÉ** |', '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | Hero | **À REMPLACER — NON CONFIRMÉ** |')
      .replace('| Facebook `1266183263247451` | 18:15 | Hero | **PROGRAMMÉ** |', '| Facebook `1266183263247451` | 18:15 | Hero | **À REMPLACER — NON CONFIRMÉ** |');
    expect([...proofReplacementPlatforms(proof)]).toEqual(['X', 'YouTube', 'Facebook']);
  });

  it('closes past registers and leaves today or future structural', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(true));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(validateProofDirectory(directory, '2026-08-13', '2026-08-13')).toEqual({ files: 2, rows: 24, urls: 12, closed: 1, open: 1 });
  });

  it('rejects an unclosed past register', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-13', '2026-08-13')).toThrow('statut PUBLIÉ manquant');
  });

  it('closes a past register when a missing publication is explicitly acknowledged as a failure', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(true, [1]));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(validateProofDirectory(directory, '2026-08-13', '2026-08-13')).toEqual({
      files: 2,
      rows: 24,
      urls: 11,
      closed: 1,
      open: 1,
      acknowledgedFailures: 1,
    });
  });

  it('rejects a missing register in the daily sequence through today', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(true));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-14.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-14', '2026-08-14')).toThrow('Registre PUBLIC-PROOF manquant pour 2026-08-13');
  });

  it('rejects two registers for the same date', () => {
    fs.writeFileSync(path.join(directory, '36-TODAY-PUBLIC-PROOF-2026-08-13.md'), register(false));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-13', '2026-08-13')).toThrow('Plusieurs registres PUBLIC-PROOF pour 2026-08-13');
  });

  it('requires the complete future campaign sequence, not only dates through today', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(true));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-13', '2026-08-14'))
      .toThrow('Registre PUBLIC-PROOF manquant pour 2026-08-14');
  });

  it('requires the explicit campaign start even if the earliest file was removed', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-13', '2026-08-13', '2026-08-12'))
      .toThrow('Registre PUBLIC-PROOF manquant pour 2026-08-12');
  });

  it('does not require dates beyond the campaign end after the campaign is over', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(true));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(true));
    expect(validateProofDirectory(directory, '2026-08-20', '2026-08-13', '2026-08-12'))
      .toEqual({ files: 2, rows: 24, urls: 24, closed: 2, open: 0 });
  });

  it('rejects registers outside the explicit campaign window', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-13.md'), register(false));
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-14.md'), register(false));
    expect(() => validateProofDirectory(directory, '2026-08-12', '2026-08-13', '2026-08-12'))
      .toThrow('Registre PUBLIC-PROOF hors campagne: 2026-08-14');
  });

  it('extracts dated YouTube titles from hero packages and proof registers', () => {
    const packages = '| 03/09 | `master.mp4` | A | `Volcanic Dream #Shorts` — `Description` | Facebook | Pinterest |';
    expect([...parseHeroYouTubeTitles(packages)]).toEqual([
      ['2026-09-03', 'Volcanic Dream #Shorts'],
    ]);
    expect(proofYouTubeTitle(register(false).replace(
      '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | Hero |',
      '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | `Volcanic Dream #Shorts` |',
    )))
      .toBe('Volcanic Dream #Shorts');
  });

  it('rejects a proof-register title that drifts from the hero package', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    expect(() => validateProofDirectory(
      directory,
      '2026-08-12',
      '2026-08-12',
      '2026-08-12',
      new Map([['2026-08-12', 'Expected Hero #Shorts']]),
    )).toThrow('titre YouTube incohérent (absent au lieu de Expected Hero #Shorts)');
  });

  it('accepts a proof-register title identical to the hero package', () => {
    const exact = register(false).replace(
      '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | Hero |',
      '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | `Expected Hero #Shorts` |',
    );
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), exact);
    expect(validateProofDirectory(
      directory,
      '2026-08-12',
      '2026-08-12',
      '2026-08-12',
      new Map([['2026-08-12', 'Expected Hero #Shorts']]),
    )).toEqual({ files: 1, rows: 12, urls: 0, closed: 0, open: 1 });
  });

  it('rejects a proof-register master that drifts from its execution card', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    expect(() => validateProofDirectory(
      directory,
      '2026-08-12',
      '2026-08-12',
      '2026-08-12',
      new Map(),
      new Map([['2026-08-12', new Map([
        ['C1', 'expected-C1.mp4'],
        ['C2', 'asset-C2.mp4'],
        ['C3', 'asset-C3.mp4'],
      ])]]),
    )).toThrow('master C1 incohérent (asset-C1.mp4 au lieu de expected-C1.mp4)');
  });

  it('accepts proof-register masters identical to the execution card', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    expect(validateProofDirectory(
      directory,
      '2026-08-12',
      '2026-08-12',
      '2026-08-12',
      new Map(),
      new Map([['2026-08-12', new Map([
        ['C1', 'asset-C1.mp4'],
        ['C2', 'asset-C2.mp4'],
        ['C3', 'asset-C3.mp4'],
      ])]]),
    )).toEqual({ files: 1, rows: 12, urls: 0, closed: 0, open: 1 });
  });

  it('rejects a pending inventory replacement missing from the proof register', () => {
    fs.writeFileSync(path.join(directory, 'PUBLIC-PROOF-2026-08-12.md'), register(false));
    expect(() => validateProofDirectory(
      directory,
      '2026-08-12',
      '2026-08-12',
      '2026-08-12',
      new Map(),
      new Map(),
      new Map([['2026-08-12', new Set(['X'])]]),
    )).toThrow('remplacement X absent du registre public');
  });
});
