'use strict';
/* global describe, expect, it, jest */

const fs = require('node:fs');
const path = require('node:path');
const {
  discoverExecutionCards,
  parseExecutionCard,
  validateCaption,
  validateExecutionCard,
  validateExecutionCards,
  validateMedia,
} = require('./check-social-execution-card');

function section(slot, master = `video-${slot}.mp4`, caption = `Dream ${slot}. #Noctalia`) {
  return `## Créneau ${slot}\n\n- Master durable :\n  \`${master}\`.\n- SHA-256 :\n  \`${'a'.repeat(64)}\`.\n- Légende exacte :\n\n\`\`\`text\n${caption}\n\`\`\`\n`;
}

describe('social execution card guard', () => {
  it('discovers the full daily calendar in operational order', () => {
    jest.spyOn(fs, 'readdirSync').mockReturnValue([
      '10-EXECUTION-CARD-2026-08-15.md',
      'README.md',
      '39-EXECUTION-CARD-2026-09-04.md',
    ]);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    expect(discoverExecutionCards('/cards').map((file) => path.basename(file))).toEqual([
      '06-TODAY-EXECUTION-CARD.md',
      '07-NEXT-DAY-EXECUTION-CARD.md',
      '10-EXECUTION-CARD-2026-08-15.md',
      '39-EXECUTION-CARD-2026-09-04.md',
    ]);

    jest.restoreAllMocks();
  });

  it('parses the three execution slots', () => {
    const entries = parseExecutionCard([1, 2, 3].map((slot) => section(slot)).join('\n'));
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ master: 'video-1.mp4', slot: 1 });
  });

  it('parses compact table cards and resolves their durable directory', () => {
    const header = '| Créneau | Asset | SHA-256 | TikTok | Instagram | X | Légende exacte |\n|---|---|---|---|---|---|---|\n';
    const rows = [1, 2, 3].map((slot) =>
      `| ${slot} | \`video-${slot}.mp4\` dans ${slot === 1 ? '\`output/video/noctalia-social-execution-2026-08-16/\`' : 'le même dossier'} | \`${'a'.repeat(64)}\` | ok | ok | ok | \`Dream ${slot}. #Noctalia\` |`
    ).join('\n');
    const entries = parseExecutionCard(`${header}${rows}`);
    expect(entries).toHaveLength(3);
    expect(entries[2].master).toBe('output/video/noctalia-social-execution-2026-08-16/video-3.mp4');
  });

  it('parses compact table cards with complete master paths', () => {
    const header = '| Créneau | Master durable | SHA-256 | TikTok | Instagram | X | Légende exacte |\n|---|---|---|---|---|---|---|\n';
    const rows = [1, 2, 3].map((slot) =>
      `| ${slot} | \`output/video/day/video-${slot}.mp4\` | \`${'a'.repeat(64)}\` | ok | ok | ok | \`Dream ${slot}. #Noctalia\` |`
    ).join('\n');
    expect(parseExecutionCard(`${header}${rows}`)[1].master).toBe('output/video/day/video-2.mp4');
  });

  it('rejects unsafe caption text', () => {
    expect(() => validateCaption('Dream. #Noctalia @someone', 1)).toThrow('@mention');
    expect(() => validateCaption('AI-generated dream #Noctalia', 1)).toThrow('AI-generated');
    expect(() => validateCaption('Dream without tag', 1)).toThrow('#Noctalia');
  });

  it('requires vertical H.264 video, AAC audio and 24 fps', () => {
    const validStreams = [
      { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '24/1' },
      { codec_type: 'audio', codec_name: 'aac' },
    ];
    expect(() => validateMedia(validStreams, 1)).not.toThrow();
    expect(() => validateMedia([{ ...validStreams[0], width: 1920, height: 1080 }, validStreams[1]], 1))
      .toThrow('vertical');
  });

  it('rejects a duplicated master within one day', () => {
    const card = [1, 2, 3].map((slot) => section(slot, slot === 3 ? 'video-2.mp4' : `video-${slot}.mp4`)).join('\n');
    jest.spyOn(fs, 'readFileSync').mockReturnValue(card);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    expect(() => validateExecutionCard(path.join('/repo', 'card.md'), {
      rootDir: '/repo',
      sha256File: () => 'a'.repeat(64),
      probeMedia: () => [
        { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '24/1' },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
    })).toThrow('dupliqué');

    jest.restoreAllMocks();
  });

  it('rejects a master reused across two daily cards', () => {
    const first = [1, 2, 3].map((slot) => section(slot, `first-${slot}.mp4`)).join('\n');
    const second = [1, 2, 3].map((slot) => section(slot, slot === 2 ? 'first-3.mp4' : `second-${slot}.mp4`)).join('\n');
    jest.spyOn(fs, 'readFileSync').mockImplementation((file) => String(file).includes('first.md') ? first : second);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    expect(() => validateExecutionCards(['/repo/first.md', '/repo/second.md'], {
      rootDir: '/repo',
      sha256File: () => 'a'.repeat(64),
      probeMedia: () => [
        { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '24/1' },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
    })).toThrow('réutilisé');

    jest.restoreAllMocks();
  });
});
