import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

/** This accepts fixture audio, never transcript text or substituted recognition events. */
export async function getNativeQaSpeechAudioSource(): Promise<ExpoSpeechRecognitionOptions['audioSource']> {
  if (process.env.EXPO_PUBLIC_NATIVE_QA_AUDIO !== 'true') return undefined;
  const urls = [process.env.EXPO_PUBLIC_API_URL, process.env.EXPO_PUBLIC_SUPABASE_URL];
  const local = urls.every(value => {
    try {
      const url = new URL(value ?? '');
      return url.protocol === 'http:' && !url.username && !url.password
        && ['127.0.0.1', 'localhost', '[::1]', '10.0.2.2'].includes(url.hostname);
    } catch { return false; }
  });
  // The config marker is emitted only by a local non-EAS QA build. applicationId
  // checks the installed native binary, so setting JS env on a Store app is refused.
  if (!local || Platform.OS === 'web' || Application.applicationId !== 'com.tanuki75.noctalia.qa'
    || Constants.expoConfig?.extra?.nativeQaAudio !== true
    || Constants.expoConfig?.extra?.eas?.projectId !== 'noctalia-qa-local') {
    throw new Error('Native QA audio requires the separate local QA binary and loopback backend.');
  }
  if (Platform.OS === 'android' && Number(Platform.Version) < 33) {
    throw new Error('Native QA file recognition requires Android API 33 or later.');
  }
  // Keep native asset initialization behind the QA identity and endpoint guards.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Asset } = require('expo-asset') as typeof import('expo-asset');
  // Metro records an asset as soon as it sees its require, even after the return above.
  // This ternary folds to undefined when the flag is not inlined as 'true', so release
  // bundles carry no QA recording; the local QA build sets the flag and keeps it.
  const fixture: number | undefined = process.env.EXPO_PUBLIC_NATIVE_QA_AUDIO === 'true'
    ? require('../assets/qa/dreamer-dictation-en.wav')
    : undefined;
  if (fixture === undefined) return undefined;
  const asset = Asset.fromModule(fixture);
  await asset.downloadAsync();
  if (!asset.localUri?.startsWith('file://')) throw new Error('Native QA speech fixture is not a local file.');
  return { uri: asset.localUri, audioChannels: 1, audioEncoding: 2, sampleRate: 16000 };
}
