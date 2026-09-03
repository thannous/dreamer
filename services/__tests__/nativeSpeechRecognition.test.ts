import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  __setCachedSpeechModuleForTests,
  buildPreview,
  ensureOfflineSttModel,
  getSpeechLocaleAvailability,
  HANDS_FREE_EMPTY_RESTART_LIMIT,
  mergeFinalChunk,
  registerOfflineModelPromptHandler,
  resolveDeviceSpeechCapability,
  shouldRestartHandsFreeSpeech,
  startNativeSpeechSession,
} from '../nativeSpeechRecognition';


describe('shouldRestartHandsFreeSpeech', () => {
  const listening = {
    platform: 'android' as const,
    dictationIntent: 'listening' as const,
    stopRequested: false,
    restartInFlight: false,
  };

  it('restarts after an unsolicited Android native end while listening', () => {
    expect(shouldRestartHandsFreeSpeech(listening)).toBe(true);
  });

  it('does not restart while paused, stopped, or already restarting', () => {
    expect(shouldRestartHandsFreeSpeech({ ...listening, dictationIntent: 'paused' })).toBe(false);
    expect(shouldRestartHandsFreeSpeech({ ...listening, dictationIntent: 'idle' })).toBe(false);
    expect(shouldRestartHandsFreeSpeech({ ...listening, stopRequested: true })).toBe(false);
    expect(shouldRestartHandsFreeSpeech({ ...listening, restartInFlight: true })).toBe(false);
  });

  it('does not restart on iOS or web, where native end is not a hands-free seam', () => {
    expect(shouldRestartHandsFreeSpeech({ ...listening, platform: 'ios' })).toBe(false);
    expect(shouldRestartHandsFreeSpeech({ ...listening, platform: 'web' })).toBe(false);
  });

  it('stops empty-end restart loops without blocking a later user resume', () => {
    expect(
      shouldRestartHandsFreeSpeech({
        ...listening,
        consecutiveEmptyRestarts: HANDS_FREE_EMPTY_RESTART_LIMIT,
      })
    ).toBe(false);
    expect(
      shouldRestartHandsFreeSpeech({
        ...listening,
        consecutiveEmptyRestarts: HANDS_FREE_EMPTY_RESTART_LIMIT - 1,
      })
    ).toBe(true);
  });
});

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

  it('prefers a corrected partial when most token positions still match', () => {
    const finalChunks = ['one two three four five six seven eight nine ten'];
    const lastPartial = 'one two three four five six seven eight nine eleven';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe(lastPartial);
  });
});

describe('native speech module integration', () => {
  afterEach(async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'web';
    delete (Platform as any).Version;
    __setCachedSpeechModuleForTests(undefined);
    registerOfflineModelPromptHandler(null);
    jest.restoreAllMocks();
  });

  it('returns null locale availability when module is missing', async () => {
    __setCachedSpeechModuleForTests(null);

    const availability = await getSpeechLocaleAvailability('en-US');

    expect(availability).toBeNull();
  });

  it('detects installed locales and Android override', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getDefaultRecognitionService: () => ({ packageName: 'com.openai.chatgpt' }),
      getSpeechRecognitionServices: () => ['com.google.android.as', 'com.other'],
      getSupportedLocales: jest.fn().mockResolvedValue({ installedLocales: ['en-US', 'fr-FR'] }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const availability = await getSpeechLocaleAvailability('fr-FR');

    expect(availability?.isInstalled).toBe(true);
    expect(availability?.androidRecognitionServicePackage).toBe('com.google.android.as');
  });

  it('returns default locale availability when lookup fails', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getDefaultRecognitionService: () => ({ packageName: 'com.openai.chatgpt' }),
      getSpeechRecognitionServices: () => ['com.google.android.as'],
      getSupportedLocales: jest.fn().mockRejectedValue(new Error('nope')),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const availability = await getSpeechLocaleAvailability('en-US');

    expect(availability?.isInstalled).toBe(false);
    expect(availability?.installedLocales).toEqual([]);
  });

  it('ensures offline model only on supported Android versions', async () => {
    const { Platform } = require('react-native');
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
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const speechModule = {
      getSupportedLocales: jest.fn().mockResolvedValue({ installedLocales: [] }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const result = await ensureOfflineSttModel('en-US');

    expect(result).toBe(false);
  });

  it('awaits the offline model prompt before checking installation again', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;

    const getSupportedLocales = jest.fn()
      .mockResolvedValueOnce({ installedLocales: [] })
      .mockResolvedValueOnce({ installedLocales: ['en-US'] });

    const speechModule = {
      getSupportedLocales,
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    let resolvePrompt: (() => void) | undefined;
    const promptHandler = {
      show: jest.fn(
        () => new Promise<void>((resolve) => {
          resolvePrompt = resolve;
        })
      ),
      isVisible: false,
    };
    registerOfflineModelPromptHandler(promptHandler);

    const resultPromise = ensureOfflineSttModel('en-US');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(promptHandler.show).toHaveBeenCalledWith('en-US');
    expect(getSupportedLocales).toHaveBeenCalledTimes(1);

    const stateBeforePromptCloses = await Promise.race([
      resultPromise.then(() => 'resolved'),
      Promise.resolve('pending'),
    ]);
    expect(stateBeforePromptCloses).toBe('pending');

    resolvePrompt?.();

    await expect(resultPromise).resolves.toBe(true);
    expect(getSupportedLocales).toHaveBeenCalledTimes(2);
  });

  it('returns null when recognition is unavailable', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const speechModule = {
      isRecognitionAvailable: () => false,
      requestPermissionsAsync: async () => ({ granted: true }),
      addListener: jest.fn(),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('en-US');

    expect(session).toBeNull();
  });

  it('returns null when permissions are denied', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: false }),
      addListener: jest.fn(),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('en-US');

    expect(session).toBeNull();
  });

  it('does not reopen Android permissions when the caller already granted microphone access', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 36;

    const requestPermissionsAsync = jest.fn(async () => ({ granted: true }));
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync,
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => true,
      getStateAsync: async () => 'inactive',
      start: jest.fn(),
      abort: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const session = await startNativeSpeechSession('fr-FR', {
      permissionAlreadyGranted: true,
    });

    expect(session).not.toBeNull();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(speechModule.start).toHaveBeenCalledTimes(1);
    session?.abort();
  });

  it('removes every listener when starting recognition throws', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';
    (Platform as any).Version = 17;

    const removeListeners = Array.from({ length: 4 }, () => jest.fn());
    let listenerIndex = 0;
    const start = jest.fn(() => {
      throw new Error('Speech start failed');
    });
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => false,
      getStateAsync: async () => 'inactive',
      start,
      addListener: jest.fn((_event: string, _cb: (payload?: any) => void) => ({
        remove: removeListeners[listenerIndex++],
      })),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    await expect(startNativeSpeechSession('en-US')).resolves.toBeNull();

    expect(start).toHaveBeenCalledTimes(1);
    expect(speechModule.addListener).toHaveBeenCalledTimes(4);
    removeListeners.forEach((remove) => expect(remove).toHaveBeenCalledTimes(1));
  });

  it('starts a speech session and captures results', async () => {
    const { Platform } = require('react-native');
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
      start: jest.fn(),
      stop: jest.fn(() => {
        listeners.get('end')?.();
      }),
      abort: jest.fn(),
      addListener: jest.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: jest.fn() };
      }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const onPartial = jest.fn();
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
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('notifies the caller when recognition ends without an explicit stop', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 36;

    const listeners = new Map<string, (event?: any) => void>();
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => true,
      getStateAsync: async () => 'inactive',
      start: jest.fn(),
      stop: jest.fn(() => {
        listeners.get('end')?.();
      }),
      abort: jest.fn(),
      addListener: jest.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: jest.fn() };
      }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const onEnd = jest.fn();
    const session = await startNativeSpeechSession('en-US', { onEnd });

    listeners.get('end')?.();

    expect(onEnd).toHaveBeenCalledTimes(1);
    await session!.stop();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not report an explicit stop as an unexpected native end', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 36;

    const listeners = new Map<string, (event?: any) => void>();
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => true,
      getStateAsync: async () => 'inactive',
      start: jest.fn(),
      stop: jest.fn(() => {
        listeners.get('end')?.();
      }),
      abort: jest.fn(),
      addListener: jest.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: jest.fn() };
      }),
    } as any;

    __setCachedSpeechModuleForTests(speechModule);

    const onEnd = jest.fn();
    const session = await startNativeSpeechSession('en-US', { onEnd });

    await session!.stop();

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('captures error events during a session', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';
    (Platform as any).Version = 17;

    const listeners = new Map<string, (event?: any) => void>();
    const speechModule = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      supportsOnDeviceRecognition: () => false,
      supportsRecording: () => false,
      getStateAsync: async () => 'inactive',
      start: jest.fn(),
      stop: jest.fn(() => {
        listeners.get('end')?.();
      }),
      abort: jest.fn(),
      addListener: jest.fn((event: string, cb: (payload?: any) => void) => {
        listeners.set(event, cb);
        return { remove: jest.fn() };
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

describe('resolveDeviceSpeechCapability — Android API levels down to minSdk 28', () => {
  afterEach(() => {
    const { Platform } = require('react-native');
    Platform.OS = 'web';
    delete (Platform as any).Version;
    __setCachedSpeechModuleForTests(undefined);
    jest.restoreAllMocks();
  });

  const androidModule = (overrides: Record<string, unknown> = {}) =>
    ({
      isRecognitionAvailable: jest.fn().mockReturnValue(true),
      supportsOnDeviceRecognition: jest.fn().mockReturnValue(false),
      getSupportedLocales: jest.fn().mockResolvedValue({ installedLocales: [] }),
      getDefaultRecognitionService: jest.fn().mockReturnValue({ packageName: 'com.google.android.as' }),
      getSpeechRecognitionServices: jest.fn().mockReturnValue(['com.google.android.as']),
      ...overrides,
    }) as any;

  // The whole point of lowering minSdk: dictation must still resolve on API 28.
  it.each([28, 29, 30])('keeps dictation available on API %i', async (version: number) => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = version;
    __setCachedSpeechModuleForTests(androidModule());

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('network');
    expect(capability.requiresOnDeviceRecognition).toBe(false);
  });

  it('does not throw when getSupportedLocales is absent below API 33', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 28;
    __setCachedSpeechModuleForTests(androidModule({ getSupportedLocales: undefined }));

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('network');
  });

  it('does not force on-device on API 31 where locales cannot be introspected', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 31;
    __setCachedSpeechModuleForTests(
      androidModule({ supportsOnDeviceRecognition: jest.fn().mockReturnValue(true) })
    );

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('network');
    expect(capability.reason).toBe('locale_introspection_unavailable');
  });

  it('prefers on-device on API 33 when the locale is installed', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 33;
    __setCachedSpeechModuleForTests(
      androidModule({
        supportsOnDeviceRecognition: jest.fn().mockReturnValue(true),
        getSupportedLocales: jest.fn().mockResolvedValue({ installedLocales: ['fr-FR', 'de-DE'] }),
      })
    );

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('on_device');
    expect(capability.requiresOnDeviceRecognition).toBe(true);
    expect(capability.localAlternatives).toEqual(['de-DE']);
  });

  it('degrades to the server fallback when no recognition service exists', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 28;
    __setCachedSpeechModuleForTests(
      androidModule({ isRecognitionAvailable: jest.fn().mockReturnValue(false) })
    );

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('server_only');
  });

  it('degrades to the server fallback when the native module is missing', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 28;
    __setCachedSpeechModuleForTests(null);

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('server_only');
  });

  it('blocks voice only when the microphone is unusable', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 34;
    __setCachedSpeechModuleForTests(androidModule());

    const capability = await resolveDeviceSpeechCapability('fr-FR', {
      microphoneAvailable: false,
    });

    expect(capability.tier).toBe('unavailable');
  });

  it('survives a native module that throws on availability probes', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'android';
    (Platform as any).Version = 29;
    __setCachedSpeechModuleForTests(
      androidModule({
        isRecognitionAvailable: jest.fn(() => {
          throw new Error('binder died');
        }),
      })
    );

    const capability = await resolveDeviceSpeechCapability('fr-FR');

    expect(capability.tier).toBe('server_only');
  });
});
