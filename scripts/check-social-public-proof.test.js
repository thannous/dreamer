'use strict';

const { parseArguments, validatePublicProof } = require('./check-social-public-proof');

const mainRows = [
  ['C1', 'TikTok', '15:30'],
  ['C1', 'Instagram', '15:45'],
  ['C1', 'X', '16:15'],
  ['C2', 'TikTok', '19:30'],
  ['C2', 'Instagram', '19:45'],
  ['C2', 'X', '20:15'],
  ['C3', 'TikTok', '22:30'],
  ['C3', 'Instagram', '22:45'],
  ['C3', 'X', '23:15'],
];
const heroRows = [
  ['Pinterest', '17:30'],
  ['YouTube', '18:00'],
  ['Facebook', '18:15'],
];

const hosts = {
  TikTok: 'www.tiktok.com',
  Instagram: 'www.instagram.com',
  X: 'x.com',
  Pinterest: 'fr.pinterest.com',
  YouTube: 'youtube.com',
  Facebook: 'www.facebook.com',
};
const accounts = {
  TikTok: '@noctaliadreams',
  Instagram: '@noctaliadreams',
  X: '@NoctaliaDreams',
  Pinterest: '@noctaliadreams',
  YouTube: 'UCQZsVAOggq_meTWYG-4dHfw',
  Facebook: '1266183263247451',
};

function proofUrl(platform, index, kind) {
  if (platform === 'TikTok') return `https://${hosts[platform]}/@noctaliadreams/video/${kind}${index}`;
  if (platform === 'Instagram') return `https://${hosts[platform]}/noctaliadreams/reel/${kind}${index}/`;
  if (platform === 'X') return `https://${hosts[platform]}/NoctaliaDreams/status/${kind}${index}`;
  return `https://${hosts[platform]}/${kind}-${index}`;
}

function register({ published = false, duplicate = false } = {}) {
  const primary = mainRows.map(([slot, platform, time], index) =>
    `| ${slot} | ${platform} \`${accounts[platform]}\` | ${time} | \`asset-${slot}.mp4\` | **${published ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${
      published ? `[URL](${proofUrl(platform, duplicate ? 0 : index, 'main')})` : 'À vérifier'
    } |`,
  );
  const secondary = heroRows.map(([platform, time], index) =>
    `| ${platform} \`${accounts[platform]}\` | ${time} | Hero | **${published ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${
      published ? `[URL](${proofUrl(platform, index, 'hero')})` : 'À vérifier'
    } |`,
  );
  return `Le hero secondaire reprend \`asset-C1.mp4\`.\n\n${[...primary, ...secondary].join('\n')}`;
}

describe('social public proof guard', () => {
  it('accepts --file before or after the closure flag', () => {
    expect(parseArguments(['--file', 'today.md'])).toEqual({
      requirePublished: false,
      files: ['today.md'],
    });
    expect(parseArguments(['--require-published', '--file', 'today.md'])).toEqual({
      requirePublished: true,
      files: ['today.md'],
    });
  });

  it('rejects malformed or unknown CLI options', () => {
    expect(() => parseArguments(['--file'])).toThrow('chemin de registre manquant');
    expect(() => parseArguments(['--unknown'])).toThrow('Option inconnue');
  });

  it('accepts a structurally complete preparatory register', () => {
    expect(validatePublicProof(register())).toEqual({ rows: 12, urls: 0 });
  });

  it('accepts a closed register with 12 distinct HTTPS URLs', () => {
    expect(validatePublicProof(register({ published: true }), { requirePublished: true }))
      .toEqual({ rows: 12, urls: 12 });
  });

  it('rejects closure when public URLs are missing', () => {
    expect(() => validatePublicProof(register(), { requirePublished: true }))
      .toThrow('statut PUBLIÉ manquant (sauf ÉCHEC — NON PUBLIÉ terminal)');
  });

  it('accepts a terminal ÉCHEC — NON PUBLIÉ without a URL when closing a past register', () => {
    const failed = register({ published: true })
      .replace('**PUBLIÉ**', '**ÉCHEC — NON PUBLIÉ**')
      .replace(`[URL](${proofUrl('TikTok', 0, 'main')})`, 'Aucune URL publique');

    expect(validatePublicProof(failed, { requirePublished: true })).toEqual({ rows: 12, urls: 11 });
  });

  it('rejects a terminal ÉCHEC — NON PUBLIÉ paired with a public URL', () => {
    const failedWithUrl = register({ published: true }).replace('**PUBLIÉ**', '**ÉCHEC — NON PUBLIÉ**');

    expect(() => validatePublicProof(failedWithUrl, { requirePublished: true }))
      .toThrow('ÉCHEC — NON PUBLIÉ incompatible avec une URL publique');
  });

  it('rejects a qualified failure that is not the explicit terminal status', () => {
    const retryableFailure = register({ published: true })
      .replace('**PUBLIÉ**', '**ÉCHEC — NON PUBLIÉ — À RÉESSAYER**')
      .replace(`[URL](${proofUrl('TikTok', 0, 'main')})`, 'Aucune URL publique');

    expect(() => validatePublicProof(retryableFailure, { requirePublished: true }))
      .toThrow('statut PUBLIÉ manquant');
  });

  it('rejects a future URL whose status is still scheduled', () => {
    const future = register({ published: true }).replace('**PUBLIÉ**', '**PROGRAMMÉ**');
    expect(() => validatePublicProof(future, { requirePublished: true }))
      .toThrow('URL publique présente sans statut PUBLIÉ');
  });

  it('rejects a future URL without closure mode too', () => {
    const future = register().replace('À vérifier', '[URL](https://www.tiktok.com/future)');
    expect(() => validatePublicProof(future))
      .toThrow('URL publique présente sans statut PUBLIÉ');
  });

  it('rejects a published status without a public URL in structure mode', () => {
    const missing = register().replace('**PROGRAMMÉ**', '**PUBLIÉ**');
    expect(() => validatePublicProof(missing))
      .toThrow('statut PUBLIÉ sans URL publique HTTPS');
  });

  it('rejects an ambiguous scheduled-public status without public proof', () => {
    const ambiguous = register().replace('**PROGRAMMÉ**', '**PROGRAMMÉ — PUBLIC**');
    expect(() => validatePublicProof(ambiguous))
      .toThrow('statut PUBLIC ambigu sans preuve PUBLIÉ');
  });

  it('rejects a proof URL on the wrong platform domain', () => {
    const wrongDomain = register({ published: true }).replace(
      'https://www.tiktok.com/@noctaliadreams/video/main0',
      'https://x.com/NoctaliaDreams/status/main0',
    );
    expect(() => validatePublicProof(wrongDomain, { requirePublished: true }))
      .toThrow('domaine de preuve invalide');
  });

  it.each([
    ['TikTok', '/@anotheraccount/video/main0'],
    ['Instagram', '/anotheraccount/reel/main1/'],
    ['X', '/anotheraccount/status/main2'],
  ])('rejects a same-domain %s URL owned by another account', (platform, pathname) => {
    const original = proofUrl(platform, mainRows.findIndex(([, name]) => name === platform), 'main');
    const wrongAccount = register({ published: true }).replace(original, `https://${hosts[platform]}${pathname}`);
    expect(() => validatePublicProof(wrongAccount, { requirePublished: true }))
      .toThrow(`URL publique hors du compte Noctalia exact pour ${platform}`);
  });

  it('rejects duplicated proof URLs', () => {
    expect(() => validatePublicProof(register({ published: true, duplicate: true }), { requirePublished: true }))
      .toThrow('dupliquée');
  });

  it('rejects a missing platform row', () => {
    const incomplete = register().split('\n').slice(0, -1).join('\n');
    expect(() => validatePublicProof(incomplete)).toThrow('12 lignes');
  });

  it('rejects a row on the wrong account', () => {
    const wrongAccount = register().replace('@NoctaliaDreams', '@anotheraccount');
    expect(() => validatePublicProof(wrongAccount)).toThrow('compte exact @NoctaliaDreams manquant');
  });

  it('rejects different assets across the three primary platforms', () => {
    const mismatch = register().replace(
      '| C1 | Instagram `@noctaliadreams` | 15:45 | `asset-C1.mp4` |',
      '| C1 | Instagram `@noctaliadreams` | 15:45 | `other.mp4` |',
    );
    expect(() => validatePublicProof(mismatch)).toThrow('assets différents');
  });

  it('rejects a secondary hero different from the primary C1 master', () => {
    const mismatch = register().replace('reprend `asset-C1.mp4`', 'reprend `other.mp4`');
    expect(() => validatePublicProof(mismatch)).toThrow('hero secondaire doit reprendre exactement');
  });
});
