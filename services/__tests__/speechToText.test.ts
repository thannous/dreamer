import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';
const { mockPlatform } = ((factory: any) => factory())(() => {
  const mockPlatform = { OS: 'ios' as PlatformOSType };
  return { mockPlatform };
});

const { mockReadAsStringAsyncInner, mockFileBase64Inner, MockFile } = ((factory: any) => factory())(() => {
  const mockReadAsStringAsyncInner = jest.fn<(uri: string, options?: { encoding: 'base64' }) => Promise<string>>();
  const mockFileBase64Inner = jest.fn<() => string | Promise<string>>();

  class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    base64 = mockFileBase64Inner;
  }

  return { mockReadAsStringAsyncInner, mockFileBase64Inner, MockFile };
});

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('expo-file-system', () => ({
  File: MockFile,
  readAsStringAsync: mockReadAsStringAsyncInner,
}));

const { mockFetchJSON, mockGetApiBaseUrl } = ((factory: any) => factory())(() => ({
  mockFetchJSON: jest.fn(),
  mockGetApiBaseUrl: jest.fn(),
}));

// Mock using relative paths from this test file
jest.mock('../../lib/config', () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

jest.mock('../../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));

const mockReadAsStringAsync = mockReadAsStringAsyncInner;
const mockFileBase64 = mockFileBase64Inner;
const { transcribeAudio, TRANSCRIPTION_TIMEOUT_MS } = require('../speechToText');

const setPlatform = (os: PlatformOSType) => {
  mockPlatform.OS = os;
};

describe('transcribeAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    mockGetApiBaseUrl.mockReturnValue('https://api.example');
    mockFetchJSON.mockResolvedValue({ transcript: 'mock transcript' });
    mockFileBase64.mockReturnValue('native-base64');
    mockReadAsStringAsync.mockResolvedValue('fallback-base64');
  });

  afterEach(() => {
    delete (globalThis as any).FileReader;
    delete (globalThis as any).fetch;
  });

  it('posts native recordings with LINEAR16 defaults on iOS', async () => {
    setPlatform('ios');

    const transcript = await transcribeAudio({
      uri: 'file:///tmp/audio.wav',
      languageCode: 'en-US',
    });

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        method: 'POST',
        body: {
          contentBase64: 'native-base64',
          encoding: 'LINEAR16',
          languageCode: 'en-US',
          sampleRateHertz: 16000,
        },
        timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
      }),
    );
    expect(transcript).toBe('mock transcript');
  });

  it('uses AMR_WB encoding hints on Android', async () => {
    setPlatform('android');

    await transcribeAudio({ uri: 'file:///tmp/audio.3gp' });

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        body: expect.objectContaining({
          contentBase64: 'native-base64',
          encoding: 'AMR_WB',
          languageCode: 'fr-FR',
          sampleRateHertz: 16000,
        }),
      }),
    );
  });

  it('uses LINEAR16 for native speech fallbacks that persist WAV on Android', async () => {
    setPlatform('android');

    await transcribeAudio({ uri: 'file:///tmp/native-recording.wav' });

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        body: expect.objectContaining({
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
        }),
      }),
    );
  });

  it('falls back to readAsStringAsync when File.base64 throws', async () => {
    setPlatform('ios');
    mockFileBase64.mockImplementationOnce(() => {
      throw new Error('base64 failed');
    });
    mockReadAsStringAsync.mockResolvedValueOnce('fallback-base64');

    await transcribeAudio({ uri: 'file:///tmp/audio.wav' });

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/audio.wav', { encoding: 'base64' });
    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        body: expect.objectContaining({
          contentBase64: 'fallback-base64',
        }),
      }),
    );
  });

  it('reads web recordings with FileReader and WEBM_OPUS encoding', async () => {
    setPlatform('web');
    const webBase64 = 'web-base64';

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      onloadend: ((ev: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.result = `data:audio/webm;base64,${webBase64}`;
        this.onloadend?.(new Event('loadend') as ProgressEvent<FileReader>);
      }
    }

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: async () => ({} as Blob),
    } as Response);

    ((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('FileReader', MockFileReader as unknown as typeof FileReader);
    ((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('fetch', fetchMock);

    await transcribeAudio({ uri: 'https://example.com/audio.webm' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/audio.webm');
    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        body: {
          contentBase64: webBase64,
          encoding: 'WEBM_OPUS',
          languageCode: 'fr-FR',
          sampleRateHertz: undefined,
        },
        timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
      }),
    );
  });
});
