import {
  LucidMorningVoiceNoteError,
  createLucidMorningVoiceNote,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';
import { shareLucidMorningVoiceNote } from '@/services/lucidMorningVoiceNoteExport';

const NOW = Date.UTC(2026, 7, 28, 8, 45, 0);

function note(overrides: Partial<LucidMorningVoiceNote> = {}): LucidMorningVoiceNote {
  return createLucidMorningVoiceNote({
    id: 'mvn_morning_share01',
    userScope: 'guest',
    status: 'ready',
    title: 'Morning voice note',
    transcript: null,
    durationMs: 1_800,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_morning_share01.m4a',
    createdAt: NOW,
    updatedAt: NOW,
    recoverable: false,
    now: NOW,
    ...overrides,
  });
}

describe('shareLucidMorningVoiceNote', () => {
  it('shares a validated local file with the real URI and mime type', async () => {
    const shareAsync = jest.fn().mockResolvedValue(undefined);
    const current = note();

    await expect(
      shareLucidMorningVoiceNote(current, {
        isAvailableAsync: async () => true,
        shareAsync,
      })
    ).resolves.toEqual({ uri: current.uri, shared: true });

    expect(shareAsync).toHaveBeenCalledTimes(1);
    expect(shareAsync).toHaveBeenCalledWith(current.uri, {
      mimeType: 'audio/mp4',
      dialogTitle: 'Morning voice note',
    });
  });

  it('does not call shareAsync when sharing is unavailable', async () => {
    const shareAsync = jest.fn();
    const current = note();
    await expect(
      shareLucidMorningVoiceNote(current, {
        isAvailableAsync: async () => false,
        shareAsync,
      })
    ).resolves.toEqual({ uri: current.uri, shared: false });
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('refuses invalid and remote notes before opening the share sheet', async () => {
    const shareAsync = jest.fn();
    const available = { isAvailableAsync: async () => true, shareAsync };

    await expect(
      shareLucidMorningVoiceNote(
        { ...note(), uri: 'https://example.com/voice.m4a' } as LucidMorningVoiceNote,
        available
      )
    ).rejects.toBeInstanceOf(LucidMorningVoiceNoteError);
    await expect(
      shareLucidMorningVoiceNote({ ...note(), title: '' } as LucidMorningVoiceNote, available)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('propagates a native share failure without claiming the file was shared', async () => {
    const shareAsync = jest.fn().mockRejectedValue(new Error('native share failed'));
    await expect(
      shareLucidMorningVoiceNote(note(), {
        isAvailableAsync: async () => true,
        shareAsync,
      })
    ).rejects.toThrow('native share failed');
    expect(shareAsync).toHaveBeenCalledTimes(1);
  });
});
