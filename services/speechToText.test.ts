import { beforeEach, describe, expect, it, vi } from 'vitest';

type PlatformOS = 'ios' | 'android' | 'macos' | 'windows' | 'web';
const { Platform } = vi.hoisted(() => {
  const Platform = { OS: 'ios' as PlatformOS };
  return { Platform };
});

const { mockReadAsStringAsync, mockFileBase64, MockFile } = vi.hoisted(() => {
  const mockReadAsStringAsync = vi.fn(async () => '');
  const mockFileBase64 = vi.fn(() => 'native-base64');

  class MockFile {
    uri: string;
    base64 = mockFileBase64;

    constructor(uri: string) {
      this.uri = uri;
    }
  }

  return { mockReadAsStringAsync, mockFileBase64, MockFile };
});

// Mock native modules before importing the service
vi.mock('expo-file-system', () => ({
  File: MockFile,
  readAsStringAsync: mockReadAsStringAsync,
}));

vi.mock('react-native', () => ({
  Platform,
}), { virtual: true });

// Mock using relative paths from this test file
vi.mock('../lib/config', () => ({
  getApiBaseUrl: () => 'https://api.dreamer.test',
}));

const { mockFetchJSON } = vi.hoisted(() => ({
  mockFetchJSON: vi.fn(),
}));

vi.mock('../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));

const fetchJSON = mockFetchJSON;
import { transcribeAudio, TRANSCRIPTION_TIMEOUT_MS } from './speechToText';

describe('speechToText Service', () => {
  const mockAudioUri = 'file://test-audio.wav';
  const mockBase64Content = 'dGVzdC1hdWRpby1iYXNlNjQ=';
  const mockTranscript = 'This is a test transcription';

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__DEV__ = false;
    (Platform as any).OS = 'ios';
    (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
    mockFileBase64.mockReturnValue('native-base64');
    mockReadAsStringAsync.mockResolvedValue(mockBase64Content);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('transcribeAudio', () => {
    it('given audio file and language when transcribing then calls API with correct parameters', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      (Platform as any).OS = 'ios';

      // When
      const result = await transcribeAudio({ uri: mockAudioUri, languageCode: 'fr-FR' });

      // Then
      expect(fetchJSON).toHaveBeenCalledWith(
        'https://api.dreamer.test/transcribe',
        expect.objectContaining({
          method: 'POST',
          body: {
            contentBase64: expect.any(String),
            encoding: 'LINEAR16',
            languageCode: 'fr-FR',
            sampleRateHertz: 16000,
          },
          timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
        })
      );
      expect(result).toBe(mockTranscript);
    });

    it('given API returns no transcript when transcribing then returns empty string', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({});
      (Platform as any).OS = 'ios';

      // When
      const result = await transcribeAudio({ uri: mockAudioUri });

      // Then
      expect(result).toBe('');
    });

    it('given API request fails when transcribing then throws user-friendly error', async () => {
      // Given
      (fetchJSON as any).mockRejectedValue(new Error('Network error'));
      (Platform as any).OS = 'ios';

      // When & Then
      await expect(transcribeAudio({ uri: mockAudioUri })).rejects.toThrow(
        'Failed to transcribe audio. Please try again.'
      );
    });

    it('given custom language code when transcribing then passes it to API', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      (Platform as any).OS = 'ios';

      // When
      await transcribeAudio({ uri: mockAudioUri, languageCode: 'de-DE' });

      // Then
      expect(fetchJSON).toHaveBeenCalledWith(
        'https://api.dreamer.test/transcribe',
        expect.objectContaining({
          body: expect.objectContaining({
            encoding: 'LINEAR16',
            languageCode: 'de-DE',
            sampleRateHertz: 16000,
          }),
        })
      );
    });

    it('given no language code when transcribing then defaults to fr-FR', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      (Platform as any).OS = 'ios';

      // When
      await transcribeAudio({ uri: mockAudioUri });

      // Then
      expect(fetchJSON).toHaveBeenCalledWith(
        'https://api.dreamer.test/transcribe',
        expect.objectContaining({
          body: expect.objectContaining({
            encoding: 'LINEAR16',
            languageCode: 'fr-FR',
            sampleRateHertz: 16000,
          }),
        })
      );
    });

    it('given development mode when transcribing then logs debug information', async () => {
      // Given
      (global as any).__DEV__ = true;
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      global.Platform = { OS: 'ios' };

      // When
      await transcribeAudio({ uri: mockAudioUri, languageCode: 'fr-FR' });

      // Then
      expect(console.log).toHaveBeenCalledWith('[speechToText] reading file', mockAudioUri);
      expect(console.log).toHaveBeenCalledWith('[speechToText] POST', 'https://api.dreamer.test/transcribe', {
        encoding: 'LINEAR16',
        languageCode: 'fr-FR',
        sampleRateHertz: 16000,
      });
      expect(console.log).toHaveBeenCalledWith('[speechToText] response', { transcript: mockTranscript });
    });
  });
});
