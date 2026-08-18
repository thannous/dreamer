'use strict';
/* global describe, expect, it, jest */

const fs = require('node:fs');
const path = require('node:path');
const {
  discoverArchiveCards,
  parseArchiveCard,
  parseFirstWaveAssets,
  validateArchiveCards,
  validateArchivePackaging,
  validateArchiveSelection,
} = require('./check-social-archive-cards');

const SHA = 'a'.repeat(64);
const CARD = (master) => `- chemin durable :\n  \`${master}\` ;\n- SHA-256 :\n  \`${SHA}\` ;\n`;
const STREAMS = [
  { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '24/1' },
  { codec_type: 'audio', codec_name: 'aac' },
];
const PACKAGES = `
Première fenêtre : 12:30. Dette HERO au plus à 10 %. Contrôle anti-doublon.
| YouTube Shorts | Titre #Noctalia |
| Facebook Reels | Copie #Noctalia |
| Pinterest | Description #Noctalia ; https://noctalia.app/?utm_source=pinterest |
`;

describe('social archive card guard', () => {
  it('discovers only archive execution cards', () => {
    jest.spyOn(fs, 'readdirSync').mockReturnValue([
      '30-ARCHIVE-PILOT-CARD-2026-08-23.md',
      '11-ARCHIVE-CARD-2026-08-31.md',
      '35-ARCHIVE-PILOT-METRICS-LOG.md',
    ]);
    expect(discoverArchiveCards('/cards').map((file) => path.basename(file))).toEqual([
      '11-ARCHIVE-CARD-2026-08-31.md',
      '30-ARCHIVE-PILOT-CARD-2026-08-23.md',
    ]);
    jest.restoreAllMocks();
  });

  it('parses the durable master and SHA-256', () => {
    expect(parseArchiveCard(CARD('/repo/archive.mp4'))).toEqual({ master: '/repo/archive.mp4', sha256: SHA });
  });

  it('rejects a duplicate archive master', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(CARD('/repo/archive.mp4') + PACKAGES);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    expect(() => validateArchiveCards(['/repo/a.md', '/repo/b.md'], {
      sha256File: () => SHA,
      probeMedia: () => STREAMS,
    })).toThrow('dupliquée');
    jest.restoreAllMocks();
  });

  it('validates vertical H.264/AAC 24 fps archives', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(CARD('/repo/archive.mp4') + PACKAGES);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    expect(validateArchiveCards(['/repo/a.md'], {
      sha256File: () => SHA,
      probeMedia: () => STREAMS,
    })).toHaveLength(1);
    jest.restoreAllMocks();
  });

  it('extracts the prioritized first archive wave in order', () => {
    const inventory = [
      '### Première vague prioritaire',
      '| Ordre | Asset | Priorité |',
      '|---:|---|---|',
      '| 1 | `pilot.mp4` | A |',
      '| 2 | `reserve.mp4` | A |',
      '',
      '### Packaging natif du pilote archive',
    ].join('\n');
    expect(parseFirstWaveAssets(inventory)).toEqual(['pilot.mp4', 'reserve.mp4']);
  });

  it('rejects an archive card without a complete three-platform package', () => {
    expect(() => validateArchivePackaging('Première fenêtre 12:30. Dette HERO 10 %. Anti-doublon.', 'archive.mp4'))
      .toThrow('package YouTube Shorts absent');
  });

  it('rejects archive cards that do not match the first priorities', () => {
    jest.spyOn(fs, 'readFileSync')
      .mockReturnValueOnce(CARD('/repo/reserve.mp4'))
      .mockReturnValueOnce(CARD('/repo/weaker.mp4'));
    const inventory = [
      '### Première vague prioritaire',
      '| 1 | `pilot.mp4` | A |',
      '| 2 | `reserve.mp4` | A |',
      '### Packaging natif du pilote archive',
    ].join('\n');
    expect(() => validateArchiveSelection(['/cards/one.md', '/cards/two.md'], inventory, 2))
      .toThrow('Cartes archive hors priorité');
    jest.restoreAllMocks();
  });
});
