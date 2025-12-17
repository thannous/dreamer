import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';
import { logger } from '@/lib/logger';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export const TRANSCRIPTION_TIMEOUT_MS = 60000;

type TranscribeParams = {
  uri: string;
  languageCode?: string;
};

type EncodingHint = {
  encoding: string;
  sampleRateHertz?: number;
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
    logger.warn('[speechToText] File API failed, falling back to readAsStringAsync', error);
    return FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
  }
}

const inferEncodingHint = (uri: string): EncodingHint => {
  const lowerUri = uri.toLowerCase();

  if (lowerUri.endsWith('.amr') || lowerUri.endsWith('.3gp')) {
    return { encoding: 'AMR_WB', sampleRateHertz: 16000 };
  }

  if (lowerUri.endsWith('.webm')) {
    // WebM/Opus carries its own sample rate metadata; let Google infer it.
    return { encoding: 'WEBM_OPUS', sampleRateHertz: undefined };
  }

  if (lowerUri.endsWith('.wav') || lowerUri.endsWith('.caf') || lowerUri.endsWith('.pcm')) {
    return { encoding: 'LINEAR16', sampleRateHertz: 16000 };
  }

  // Fall back to platform defaults when we cannot infer from the URI.
  if (Platform.OS === 'android') {
    return { encoding: 'AMR_WB', sampleRateHertz: 16000 };
  }

  if (Platform.OS === 'web') {
    return { encoding: 'WEBM_OPUS', sampleRateHertz: undefined };
  }

  return { encoding: 'LINEAR16', sampleRateHertz: 16000 };
};

export async function transcribeAudio({
  uri,
  languageCode = 'fr-FR',
}: TranscribeParams): Promise<string> {
  logger.debug('[speechToText] reading file', uri);

  const contentBase64 = await readAudioAsBase64(uri);

  logger.debug('[speechToText] file size (base64 chars)', contentBase64.length);

  // Pick encoding/sample hints based on the recorded file type, with platform defaults as fallback.
  const { encoding, sampleRateHertz } = inferEncodingHint(uri);

  const base = getApiBaseUrl();

  logger.debug('[speechToText] POST', `${base}/transcribe`, { encoding, languageCode, sampleRateHertz });

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

    logger.debug('[speechToText] response', res);

    return res.transcript ?? '';
  } catch (error) {
    logger.error('[speechToText] fetch failed', error);
    throw new Error('Failed to transcribe audio. Please try again.');
  }
}
