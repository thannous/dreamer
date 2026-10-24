import * as Application from 'expo-application';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNativeQaSpeechAudioSource } from '../nativeQaSpeechAudio';

const mockAsset = { localUri: 'file:///synthetic-speech.wav', downloadAsync: jest.fn(async () => undefined) };
jest.mock('expo-application', () => ({ applicationId: 'com.tanuki75.noctalia.qa' }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn(() => mockAsset) } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', Version: 18 } }));

const keys = ['EXPO_PUBLIC_NATIVE_QA_AUDIO', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL'] as const;
const initial = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const nativeIdentity = Application as { applicationId: string | null };
const platform = Platform as unknown as { OS: string; Version: number };

// The device journey intentionally runs only a valid QA build. These controls
// detect a fixture escaping into the base/Store app or remote backend without
// installing an unsafe candidate or contacting a remote speech service.
describe('native QA speech input containment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_NATIVE_QA_AUDIO = 'true';
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:31284/functions/v1/api';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:31284';
    nativeIdentity.applicationId = 'com.tanuki75.noctalia.qa';
    platform.OS = 'ios'; platform.Version = 18;
    Constants.expoConfig = { name: 'Noctalia QA', slug: 'noctalia', extra: {
      nativeQaAudio: true, eas: { projectId: 'noctalia-qa-local' },
    } };
    mockAsset.localUri = 'file:///synthetic-speech.wav';
  });
  afterAll(() => {
    for (const key of keys) {
      if (initial[key] === undefined) delete process.env[key];
      else process.env[key] = initial[key];
    }
  });
  it('does not resolve fixture assets unless the explicit opt-in is enabled', async () => {
    delete process.env.EXPO_PUBLIC_NATIVE_QA_AUDIO;
    await expect(getNativeQaSpeechAudioSource()).resolves.toBeUndefined();
    expect(Asset.fromModule).not.toHaveBeenCalled();
  });
  it('supplies local audio bytes to the real recognizer, without transcript content', async () => {
    await expect(getNativeQaSpeechAudioSource()).resolves.toEqual({
      uri: 'file:///synthetic-speech.wav', audioChannels: 1, audioEncoding: 2, sampleRate: 16000,
    });
    expect(mockAsset.downloadAsync).toHaveBeenCalledTimes(1);
  });
  it.each(['com.tanuki75.noctalia', 'com.tanuki75.noctalia.lucid', null])('refuses installed binary %s', async id => {
    nativeIdentity.applicationId = id;
    await expect(getNativeQaSpeechAudioSource()).rejects.toThrow('separate local QA binary');
    expect(Asset.fromModule).not.toHaveBeenCalled();
  });
  it.each(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL'] as const)('refuses a remote %s even with the local QA flag', async key => {
    process.env[key] = 'https://example.invalid';
    await expect(getNativeQaSpeechAudioSource()).rejects.toThrow('loopback backend');
    expect(Asset.fromModule).not.toHaveBeenCalled();
  });
  it('refuses an unstamped build and an audio asset without a local URI', async () => {
    Constants.expoConfig!.extra!.nativeQaAudio = false;
    await expect(getNativeQaSpeechAudioSource()).rejects.toThrow('separate local QA binary');
    Constants.expoConfig!.extra!.nativeQaAudio = true;
    mockAsset.localUri = 'https://example.invalid/audio.wav';
    await expect(getNativeQaSpeechAudioSource()).rejects.toThrow('not a local file');
  });
  it('refuses unsupported Android file transcription before resolving the asset', async () => {
    platform.OS = 'android'; platform.Version = 32;
    await expect(getNativeQaSpeechAudioSource()).rejects.toThrow('API 33');
    expect(Asset.fromModule).not.toHaveBeenCalled();
  });
});
