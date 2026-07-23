import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;

type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';
const { mockPlatform } = ((factory: any) => factory())(() => {
  const mockPlatform = { OS: 'ios' as PlatformOSType };
  return { mockPlatform };
});

const { mockReadAsStringAsyncInner, mockFileBase64Inner, MockFile } = ((factory: any) => factory())(() => {
  const mockReadAsStringAsyncInner = typedJestFn<(uri: string, options?: { encoding: 'base64' }) => Promise<string>>();
  const mockFileBase64Inner = typedJestFn<() => string | Promise<string>>();

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

const { mockFetchJSONWithSession, mockGetApiBaseUrl } = ((factory: any) => factory())(() => ({
  mockFetchJSONWithSession: jest.fn(),
  mockGetApiBaseUrl: jest.fn(),
}));

// Mock using relative paths from this test file
jest.mock('../../lib/config', () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

jest.mock('../../lib/apiSession', () => ({
  fetchJSONWithSession: mockFetchJSONWithSession,
}));

const mockReadAsStringAsync = mockReadAsStringAsyncInner;
const mockFileBase64 = mockFileBase64Inner;
const {
  MAX_TRANSCRIPTION_BASE64_LENGTH,
  transcribeAudio,
  TRANSCRIPTION_TIMEOUT_MS,
} = require('../speechToText');

const setPlatform = (os: PlatformOSType) => {
  mockPlatform.OS = os;
};

describe('transcribeAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    mockGetApiBaseUrl.mockReturnValue('https://api.example');
    mockFetchJSONWithSession.mockResolvedValue({ transcript: 'mock transcript' });
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

    expect(mockFetchJSONWithSession).toHaveBeenCalledWith(
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

  it('returns an empty string when the API omits the transcript', async () => {
    setPlatform('ios');
    mockFetchJSONWithSession.mockResolvedValueOnce({});

    await expect(transcribeAudio({ uri: 'file:///tmp/audio.wav' })).resolves.toBe('');
  });

  it('rethrows request failures as a user-facing transcription error', async () => {
    setPlatform('ios');
    mockFetchJSONWithSession.mockRejectedValueOnce(new Error('Network error'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(transcribeAudio({ uri: 'file:///tmp/audio.wav' })).rejects.toThrow(
      'Failed to transcribe audio. Please try again.'
    );
    expect(errorSpy).toHaveBeenCalledWith('[speechToText] fallback request failed');

    errorSpy.mockRestore();
  });

  it('logs fallback request diagnostics in development', async () => {
    setPlatform('ios');
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await transcribeAudio({
      uri: 'file:///tmp/audio.wav',
      languageCode: 'fr-FR',
    });

    expect(logSpy).toHaveBeenCalledWith('[speechToText] reading fallback recording');
    expect(logSpy).toHaveBeenCalledWith('[speechToText] file size (base64 chars)', 13);
    expect(logSpy).toHaveBeenCalledWith('[speechToText] POST', 'https://api.example/transcribe', {
      encoding: 'LINEAR16',
      languageCode: 'fr-FR',
      sampleRateHertz: 16000,
    });
    expect(logSpy).toHaveBeenCalledWith('[speechToText] fallback response received', {
      transcriptLength: 'mock transcript'.length,
    });

    logSpy.mockRestore();
  });

  it('uses AMR_WB encoding hints on Android', async () => {
    setPlatform('android');

    await transcribeAudio({ uri: 'file:///tmp/audio.3gp' });

    expect(mockFetchJSONWithSession).toHaveBeenCalledWith(
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

    expect(mockFetchJSONWithSession).toHaveBeenCalledWith(
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
    expect(mockFetchJSONWithSession).toHaveBeenCalledWith(
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

    const fetchMock = typedJestFn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: async () => ({} as Blob),
    } as Response);

    ((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('FileReader', MockFileReader as unknown as typeof FileReader);
    ((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('fetch', fetchMock);

    await transcribeAudio({ uri: 'https://example.com/audio.webm' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/audio.webm');
    expect(mockFetchJSONWithSession).toHaveBeenCalledWith(
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

  it('rejects oversized inline audio before making a network request', async () => {
    setPlatform('android');
    mockFileBase64.mockReturnValueOnce('a'.repeat(MAX_TRANSCRIPTION_BASE64_LENGTH + 1));

    await expect(transcribeAudio({ uri: 'file:///tmp/too-long.amr' })).rejects.toThrow(
      'Recording is too long to transcribe'
    );

    expect(mockFetchJSONWithSession).not.toHaveBeenCalled();
  });
});
