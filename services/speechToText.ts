import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export const TRANSCRIPTION_TIMEOUT_MS = 60000;

type TranscribeParams = {
  uri: string;
  languageCode?: string;
};

async function readAudioAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch recording blob: ${response.status}`);
    }
    const blob = await response.blob();
    const reader = new FileReader();
    return await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('Failed to read blob as base64'));
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const base64 = result.split(',')[1] ?? '';
          resolve(base64);
        } else {
          reject(new Error('Unexpected FileReader result'));
        }
      };
      reader.readAsDataURL(blob);
    });
  }

  try {
    const file = new File(uri);
    const base64 = file.base64();
    if (typeof base64 === 'string') {
      return base64;
    }
    return await base64; // handle potential promise
  } catch (error) {
    console.warn('[speechToText] File API failed, falling back to readAsStringAsync', error);
    return FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
  }
}

export async function transcribeAudio({
  uri,
  languageCode = 'fr-FR',
}: TranscribeParams): Promise<string> {
  if (__DEV__) {
    console.log('[speechToText] reading file', uri);
  }

  const contentBase64 = await readAudioAsBase64(uri);

  if (__DEV__) {
    console.log('[speechToText] file size (base64 chars)', contentBase64.length);
  }

  // Pick encoding/sample hints based on platform + our recording options
  // - iOS: WAV Linear PCM -> LINEAR16 @ 16000 Hz
  // - Android: 3GP AMR-WB -> AMR_WB @ 16000 Hz
  // - Web: WebM/Opus -> WEBM_OPUS @ 48000 Hz (MediaRecorder default for Opus)
  let encoding = 'LINEAR16';
  let sampleRateHertz: number | undefined = 16000;

  if (Platform.OS === 'android') {
    encoding = 'AMR_WB';
    sampleRateHertz = 16000;
  } else if (Platform.OS === 'web') {
    encoding = 'WEBM_OPUS';
    sampleRateHertz = 48000;
  }

  const base = getApiBaseUrl();

  if (__DEV__) {
    console.log('[speechToText] POST', `${base}/transcribe`, { encoding, languageCode, sampleRateHertz });
  }

  try {
    const res = await fetchJSON<{ transcript?: string }>(`${base}/transcribe`, {
      method: 'POST',
      body: {
        contentBase64,
        encoding,
        languageCode,
        sampleRateHertz,
      },
      // Transcription can take a bit longer
      timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    });

    if (__DEV__) {
      console.log('[speechToText] response', res);
    }

    return res.transcript ?? '';
  } catch (error) {
    if (__DEV__) {
      console.error('[speechToText] fetch failed', error);
    }
    throw new Error('Failed to transcribe audio. Please try again.');
  }
}
