'use strict';
/* global describe, expect, it */

const { parseDebtCard, validateDebtRows } = require('./check-social-instagram-debt');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const STREAMS = [
  { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '24/1' },
  { codec_type: 'audio', codec_name: 'aac' },
];
const ROW = (date, asset, sha) => ({
  date,
  account: 'Instagram `@noctaliadreams`',
  asset,
  sha256: sha,
  caption: `A dream appears. Would you follow it? #Noctalia #Dreamscape`,
  status: '**AFFECTÉ — PRÊT — NON PUBLIÉ**',
  master: `/repo/${asset}`,
});
const OPTIONS = {
  existsSync: () => true,
  sha256File: (file) => file.includes('66-') ? SHA_A : SHA_B,
  probeMedia: () => STREAMS,
};

describe('social Instagram primary debt guard', () => {
  it('parses affected rows and exact local paths', () => {
    const content = `| Date et heure | Compte | Asset exact | SHA-256 | Légende exacte | Statut |\n|---|---|---|---|---|---|\n| 16/08 à 12:45 | Instagram \`@noctaliadreams\` | \`66-fleuve.mp4\` | \`${SHA_A}\` | \`A dream. #Noctalia\` | **AFFECTÉ — PRÊT — NON PUBLIÉ** |\n\nChemins locaux exacts :\n\n- \`/repo/66-fleuve.mp4\` ;\n\n## Gate obligatoire\n`;
    expect(parseDebtCard(content)[0]).toMatchObject({ asset: '66-fleuve.mp4', master: '/repo/66-fleuve.mp4' });
  });

  it('accepts two exact weekly debts', () => {
    expect(validateDebtRows([
      ROW('16/08 à 12:45', '66-fleuve.mp4', SHA_A),
      ROW('23/08 à 12:45', '69-cascade.mp4', SHA_B),
    ], OPTIONS)).toHaveLength(2);
  });

  it('rejects a wrong account', () => {
    const row = ROW('16/08 à 12:45', '66-fleuve.mp4', SHA_A);
    row.account = 'Instagram `@wrong`';
    expect(() => validateDebtRows([row], OPTIONS)).toThrow('Compte Instagram invalide');
  });

  it('rejects a slot too close to primary C1', () => {
    expect(() => validateDebtRows([ROW('16/08 à 14:00', '66-fleuve.mp4', SHA_A)], OPTIONS)).toThrow('Créneau de dette invalide');
  });

  it('rejects debts less than seven days apart', () => {
    expect(() => validateDebtRows([
      ROW('16/08 à 12:45', '66-fleuve.mp4', SHA_A),
      ROW('22/08 à 12:45', '69-cascade.mp4', SHA_B),
    ], OPTIONS)).toThrow('sept jours');
  });

  it('rejects a reused binary hash', () => {
    expect(() => validateDebtRows([
      ROW('16/08 à 12:45', '66-fleuve.mp4', SHA_A),
      ROW('23/08 à 12:45', '69-cascade.mp4', SHA_A),
    ], { ...OPTIONS, sha256File: () => SHA_A })).toThrow('dupliquée');
  });
});
