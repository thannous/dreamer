'use strict';

const { parisParts, parseArguments, validateDueProof } = require('./check-social-due-proof');

const mainRows = [
  ['C1', 'TikTok', '@noctaliadreams', '15:30', 'https://www.tiktok.com/@noctaliadreams/video/1'],
  ['C1', 'Instagram', '@noctaliadreams', '15:45', 'https://www.instagram.com/noctaliadreams/reel/1/'],
  ['C1', 'X', '@NoctaliaDreams', '16:15', 'https://x.com/NoctaliaDreams/status/1'],
  ['C2', 'TikTok', '@noctaliadreams', '19:30', 'https://www.tiktok.com/@noctaliadreams/video/2'],
  ['C2', 'Instagram', '@noctaliadreams', '19:45', 'https://www.instagram.com/noctaliadreams/reel/2/'],
  ['C2', 'X', '@NoctaliaDreams', '20:15', 'https://x.com/NoctaliaDreams/status/2'],
  ['C3', 'TikTok', '@noctaliadreams', '22:30', 'https://www.tiktok.com/@noctaliadreams/video/3'],
  ['C3', 'Instagram', '@noctaliadreams', '22:45', 'https://www.instagram.com/noctaliadreams/reel/3/'],
  ['C3', 'X', '@NoctaliaDreams', '23:15', 'https://x.com/NoctaliaDreams/status/3'],
];
const heroes = [
  ['Pinterest', '@noctaliadreams', '17:30', 'https://pinterest.com/pin/1'],
  ['YouTube', 'UCQZsVAOggq_meTWYG-4dHfw', '18:00', 'https://youtube.com/shorts/1'],
  ['Facebook', '1266183263247451', '18:15', 'https://facebook.com/reel/1'],
];

function register(publishedRows = [], failureRows = []) {
  const published = new Set(publishedRows);
  const failures = new Set(failureRows);
  const primary = mainRows.map(([slot, platform, account, time, url], index) =>
    `| ${slot} | ${platform} \`${account}\` | ${time} | \`asset-${slot}.mp4\` | **${failures.has(index) ? 'ÉCHEC — NON PUBLIÉ' : published.has(index) ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${published.has(index) && !failures.has(index) ? `[URL](${url})` : 'À vérifier'} |`);
  const secondary = heroes.map(([platform, account, time, url], index) => {
    const row = index + 9;
    return `| ${platform} \`${account}\` | ${time} | Hero | **${failures.has(row) ? 'ÉCHEC — NON PUBLIÉ' : published.has(row) ? 'PUBLIÉ' : 'PROGRAMMÉ'}** | ${published.has(row) && !failures.has(row) ? `[URL](${url})` : 'À vérifier'} |`;
  });
  return `Le hero secondaire reprend \`asset-C1.mp4\`.\n\n${[...primary, ...secondary].join('\n')}`;
}

describe('same-day due proof guard', () => {
  it('converts an absolute instant to Europe/Paris campaign time', () => {
    expect(parisParts(new Date('2026-08-14T14:06:00Z'))).toEqual({ date: '2026-08-14', time: '16:06' });
  });

  it('accepts the preparatory register before the first verification checkpoint', () => {
    expect(validateDueProof(register(), new Date('2026-08-14T14:04:00+02:00')))
      .toEqual({ date: '2026-08-14', time: '14:04', due: 0, published: 0, skipped: false });
  });

  it('requires C1 TikTok and Instagram after their checkpoint', () => {
    expect(() => validateDueProof(register([0]), new Date('2026-08-14T16:06:00+02:00')))
      .toThrow('C1 Instagram (contrôle 16:05)');
    expect(validateDueProof(register([0, 1]), new Date('2026-08-14T16:06:00+02:00')).due).toBe(2);
  });

  it('accepts an explicit failure as a handled due checkpoint without a URL', () => {
    expect(validateDueProof(register([0], [1]), new Date('2026-08-14T16:06:00+02:00')))
      .toEqual({
        date: '2026-08-14',
        time: '16:06',
        due: 2,
        published: 1,
        skipped: false,
        acknowledgedFailures: 1,
      });
  });

  it('requires all six daytime proofs after the Facebook checkpoint', () => {
    expect(() => validateDueProof(register([0, 1, 2, 9, 10]), new Date('2026-08-14T18:46:00+02:00')))
      .toThrow('Facebook hero (contrôle 18:45)');
    expect(validateDueProof(register([0, 1, 2, 9, 10, 11]), new Date('2026-08-14T18:46:00+02:00')).due).toBe(6);
  });

  it('requires all twelve proofs after the final checkpoint', () => {
    expect(() => validateDueProof(register([...Array(11).keys()]), new Date('2026-08-14T23:46:00+02:00')))
      .toThrow('Facebook hero');
    expect(validateDueProof(register([...Array(12).keys()]), new Date('2026-08-14T23:46:00+02:00')).due).toBe(12);
  });

  it('skips dates outside the campaign', () => {
    expect(validateDueProof(register(), new Date('2026-09-11T12:00:00+02:00')).skipped).toBe(true);
  });

  it('rejects malformed CLI timestamps and unknown options', () => {
    expect(() => parseArguments(['--now', 'not-a-date'])).toThrow('Option --now invalide');
    expect(() => parseArguments(['--other'])).toThrow('Option inconnue');
  });
});
