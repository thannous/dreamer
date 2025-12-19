import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __setCachedSpeechModuleForTests,
  buildPreview,
  ensureOfflineSttModel,
  getSpeechLocaleAvailability,
  mergeFinalChunk,
  registerOfflineModelPromptHandler,
  startNativeSpeechSession,
} from '../nativeSpeechRecognition';

describe('mergeFinalChunk', () => {
  it('replaces the last chunk when the new chunk extends it', () => {
    const result = mergeFinalChunk(['je dors'], 'je dors dans mon lit');

    expect(result).toEqual(['je dors dans mon lit']);
  });

  it('ignores a shorter duplicate chunk', () => {
    const result = mergeFinalChunk(['hello world'], 'hello');

    expect(result).toEqual(['hello world']);
  });

  it('keeps existing when chunk is identical', () => {
    const result = mergeFinalChunk(['bonjour'], 'Bonjour   ');

    expect(result).toEqual(['bonjour']);
  });

  it('appends unrelated chunks', () => {
    const result = mergeFinalChunk(['first chunk'], 'second part');

    expect(result).toEqual(['first chunk', 'second part']);
  });

  it('returns original list for empty input', () => {
    const result = mergeFinalChunk(['kept'], '   ');

    expect(result).toEqual(['kept']);
  });
});

describe('buildPreview', () => {
  it('avoids duplication when partial extends last final chunk', () => {
    // Scenario: user says "J'ai fait un rêve", it becomes final,
    // then continues with "étrange" but STT sends full sentence as partial
    const finalChunks = ["J'ai fait un rêve"];
    const lastPartial = "J'ai fait un rêve étrange";

    const result = buildPreview(finalChunks, lastPartial);

    // Should NOT be "J'ai fait un rêve J'ai fait un rêve étrange"
    expect(result).toBe("J'ai fait un rêve étrange");
  });

  it('concatenates when partial is unrelated to final chunks', () => {
    const finalChunks = ['première phrase'];
    const lastPartial = 'deuxième phrase';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('première phrase deuxième phrase');
  });

  it('preserves earlier chunks when partial extends only the last one', () => {
    const finalChunks = ['début du rêve', 'ensuite il y avait'];
    const lastPartial = 'ensuite il y avait un chat';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('début du rêve ensuite il y avait un chat');
  });

  it('returns only partial when no final chunks and partial exists', () => {
    const result = buildPreview([], 'just a partial');

    expect(result).toBe('just a partial');
  });

  it('returns final chunks when partial is empty', () => {
    const result = buildPreview(['chunk one', 'chunk two'], '');

    expect(result).toBe('chunk one chunk two');
  });

  it('handles case and spacing differences', () => {
    const finalChunks = ['Hello world'];
    const lastPartial = 'hello world how are you';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('hello world how are you');
  });

  it('returns empty string when both inputs are empty', () => {
    const result = buildPreview([], '');

    expect(result).toBe('');
  });

  it('prefers partial when it nearly matches finals', () => {
    const finalChunks = ['alpha beta gamma'];
    const lastPartial = 'alpha beta gamma delta';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('alpha beta gamma delta');
  });
});

describe('native speech module integration', () => {
  afterEach(async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'web';
    delete (Platform as any).Version;
    __setCachedSpeechModuleForTests(undefined);
    registerOfflineModelPromptHandler(null);
  });

  it('returns null locale availability when module is missing', async () => {
    __setCachedSpeechModuleForTests(null);

    const availability = await getSpeechLocaleAvailability('en-US');

    expect(availability).toBeNull();
  });

  it('detects installed locales and Android override', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getDefaultRecognitionService: () => ({ packageName: 'com.openai.chatgpt' }),
      getSpeechRecognitionServices: () => ['com.google.android.as', 'com.other'],
      getSupportedLocales: vi.fn().mockResolvedValue({ installedLocales: ['en-US', 'fr-FR'] }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const availability = await getSpeechLocaleAvailability('fr-FR');

    expect(availability?.isInstalled).toBe(true);
    expect(availability?.androidRecognitionServicePackage).toBe('com.google.android.as');
  });

  it('returns default locale availability when lookup fails', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getDefaultRecognitionService: () => ({ packageName: 'com.openai.chatgpt' }),
      getSpeechRecognitionServices: () => ['com.google.android.as'],
      getSupportedLocales: vi.fn().mockRejectedValue(new Error('nope')),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const availability = await getSpeechLocaleAvailability('en-US');

    expect(availability?.isInstalled).toBe(false);
    expect(availability?.installedLocales).toEqual([]);
  });

  it('ensures offline model only on supported Android versions', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    (Platform as any).Version = 16;

    const unsupported = await ensureOfflineSttModel('en-US');
    expect(unsupported).toBe(false);

    Platform.OS = 'android';
    (Platform as any).Version = 30;

    const tooOld = await ensureOfflineSttModel('en-US');
    expect(tooOld).toBe(false);
  });

  it('returns false when offline model is missing and no handler exists', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getSupportedLocales: vi.fn().mockResolvedValue({ installedLocales: [] }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const result = await ensureOfflineSttModel('en-US');

    expect(result).toBe(false);
  });

  it('uses the offline model prompt handler when available', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const getSupportedLocales = vi.fn()
      .mockResolvedValueOnce({ installedLocales: [] })
      .mockResolvedValueOnce({ installedLocales: ['en-US'] });

    const speechModule = {
      getSupportedLocales,
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const promptHandler = {
      show: vi.fn().mockResolvedValue(undefined),
      isVisible: false,
    };
    registerOfflineModelPromptHandler(promptHandler);

    const result = await ensureOfflineSttModel('en-US');

    expect(promptHandler.show).toHaveBeenCalledWith('en-US');
    expect(result).toBe(true);
  });

  it('returns null when recognition is unavailable', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';

    const speechModule = {
      isRecognitionAvailable: () => false,
      requestPermissionsAsync: async () => ({ granted: true }),
      addListener: vi.fn(),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('en-US');

    expect(session).toBeNull();
  });

  it('returns null when permissions are denied', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';

    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: false }),
      addListener: vi.fn(),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('en-US');

    expect(session).toBeNull();
  });

  it('starts a speech session and captures results', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    (Platform as any).Version = 17;

    const listeners = new Map<string, (event?: any) => void>();
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => true,
      getDefaultRecognitionService: () => ({ packageName: 'com.google.android.as' }),
      getSpeechRecognitionServices: () => [],
      getSupportedLocales: async () => ({ installedLocales: ['en-US'] }),
      getStateAsync: async () => 'inactive',
      start: vi.fn(),
      stop: vi.fn(() => {
        listeners.get('end')?.();
      }),
      abort: vi.fn(),
      addListener: vi.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: vi.fn() };
      }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const onPartial = vi.fn();
    const session = await startNativeSpeechSession('en-US', { onPartial });

    expect(session).not.toBeNull();

    listeners.get('result')?.({ results: [{ transcript: 'hello' }], isFinal: false });
    listeners.get('result')?.({ results: [{ transcript: 'hello world' }], isFinal: true });
    listeners.get('audioend')?.({ uri: 'file://audio.pcm' });

    const result = await session!.stop();

    expect(onPartial).toHaveBeenCalled();
    expect(result.transcript).toBe('hello world');
    expect(result.recordedUri).toBe('file://audio.pcm');
    expect(result.hasRecording).toBe(true);
  });

  it('captures error events during a session', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    (Platform as any).Version = 17;

    const listeners = new Map<string, (event?: any) => void>();
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => false,
      getStateAsync: async () => 'inactive',
      start: vi.fn(),
      stop: vi.fn(() => {
        listeners.get('end')?.();
      }),
      abort: vi.fn(),
      addListener: vi.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: vi.fn() };
      }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('en-US');
    listeners.get('error')?.({ error: 'network', message: 'lost' });

    const result = await session!.stop();

    expect(result.error).toBe('lost');
    expect(result.errorCode).toBe('network');
  });
});
