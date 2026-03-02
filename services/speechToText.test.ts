import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type PlatformOS = 'ios' | 'android' | 'macos' | 'windows' | 'web';
const { mockPlatform } = ((factory: any) => factory())(() => {
  const mockPlatform = { OS: 'ios' as PlatformOS };
  return { mockPlatform };
});

const { mockReadAsStringAsync, mockFileBase64, MockFile } = ((factory: any) => factory())(() => {
  const mockReadAsStringAsync = jest.fn(async () => '');
  const mockFileBase64 = jest.fn(() => 'native-base64');

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
jest.mock('expo-file-system', () => ({
  File: MockFile,
  readAsStringAsync: mockReadAsStringAsync,
}));

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

// Mock using relative paths from this test file
jest.mock('../lib/config', () => ({
  getApiBaseUrl: () => 'https://api.dreamer.test',
}));

const { mockFetchJSON } = ((factory: any) => factory())(() => ({
  mockFetchJSON: jest.fn(),
}));

jest.mock('../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));

const { transcribeAudio, TRANSCRIPTION_TIMEOUT_MS } = require('./speechToText');
const fetchJSON = mockFetchJSON;

describe('speechToText Service', () => {
  const mockAudioUri = 'file://test-audio.wav';
  const mockBase64Content = 'dGVzdC1hdWRpby1iYXNlNjQ=';
  const mockTranscript = 'This is a test transcription';

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__DEV__ = false;
    (mockPlatform as any).OS = 'ios';
    (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
    mockFileBase64.mockReturnValue('native-base64');
    mockReadAsStringAsync.mockResolvedValue(mockBase64Content);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('transcribeAudio', () => {
    it('given audio file and language when transcribing then calls API with correct parameters', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      (mockPlatform as any).OS = 'ios';

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
      (mockPlatform as any).OS = 'ios';

      // When
      const result = await transcribeAudio({ uri: mockAudioUri });

      // Then
      expect(result).toBe('');
    });

    it('given API request fails when transcribing then throws user-friendly error', async () => {
      // Given
      (fetchJSON as any).mockRejectedValue(new Error('Network error'));
      (mockPlatform as any).OS = 'ios';

      // When & Then
      await expect(transcribeAudio({ uri: mockAudioUri })).rejects.toThrow(
        'Failed to transcribe audio. Please try again.'
      );
    });

    it('given custom language code when transcribing then passes it to API', async () => {
      // Given
      (fetchJSON as any).mockResolvedValue({ transcript: mockTranscript });
      (mockPlatform as any).OS = 'ios';

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
      (mockPlatform as any).OS = 'ios';

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
      (globalThis as any).Platform = { OS: 'ios' };

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
