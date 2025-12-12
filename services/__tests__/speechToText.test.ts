import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';
const { Platform } = vi.hoisted(() => {
  const Platform = { OS: 'ios' as PlatformOSType };
  return { Platform };
});

const { readAsStringAsync, fileBase64, MockFile } = vi.hoisted(() => {
  const readAsStringAsync = vi.fn<(uri: string, options?: { encoding: 'base64' }) => Promise<string>>();
  const fileBase64 = vi.fn<() => string | Promise<string>>();

  class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    base64 = fileBase64;
  }

  return { readAsStringAsync, fileBase64, MockFile };
});

vi.mock('react-native', () => ({
  Platform,
}));

vi.mock('expo-file-system', () => ({
  File: MockFile,
  readAsStringAsync,
}));

const { mockFetchJSON, mockGetApiBaseUrl } = vi.hoisted(() => ({
  mockFetchJSON: vi.fn(),
  mockGetApiBaseUrl: vi.fn(),
}));

// Mock using relative paths from this test file
vi.mock('../../lib/config', () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

vi.mock('../../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));

import { transcribeAudio, TRANSCRIPTION_TIMEOUT_MS } from '../speechToText';
const mockReadAsStringAsync = readAsStringAsync;
const mockFileBase64 = fileBase64;

const setPlatform = (os: PlatformOSType) =>
  vi.spyOn(Platform, 'OS', 'get').mockReturnValue(os);

let platformSpy: ReturnType<typeof setPlatform> | undefined;

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    mockGetApiBaseUrl.mockReturnValue('https://api.example');
    mockFetchJSON.mockResolvedValue({ transcript: 'mock transcript' });
    mockFileBase64.mockReturnValue('native-base64');
    mockReadAsStringAsync.mockResolvedValue('fallback-base64');
  });

  afterEach(() => {
    platformSpy?.mockRestore();
    platformSpy = undefined;
    vi.unstubAllGlobals();
  });

  it('posts native recordings with LINEAR16 defaults on iOS', async () => {
    platformSpy = setPlatform('ios');

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
    platformSpy = setPlatform('android');

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
    platformSpy = setPlatform('android');

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
    platformSpy = setPlatform('ios');
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
    platformSpy = setPlatform('web');
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

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: async () => ({} as Blob),
    } as Response);

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
    vi.stubGlobal('fetch', fetchMock);

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
