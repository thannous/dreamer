import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';

type TranscribeParams = {
  uri: string;
  languageCode?: string;
};

export async function transcribeAudio({
  uri,
  languageCode = 'fr-FR',
}: TranscribeParams): Promise<string> {
  // Read the recorded file as base64
  const contentBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Pick encoding/sample hints based on platform + our recording options
  // - iOS: WAV Linear PCM -> LINEAR16 @ 16000 Hz
  // - Android: 3GP AMR-WB -> AMR_WB @ 16000 Hz
  // - Web: WebM/Opus -> WEBM_OPUS (let Google auto-detect sample rate)
  let encoding = 'LINEAR16';
  let sampleRateHertz: number | undefined = 16000;

  if (Platform.OS === 'android') {
    encoding = 'AMR_WB';
    sampleRateHertz = 16000;
  } else if (Platform.OS === 'web') {
    encoding = 'WEBM_OPUS';
    sampleRateHertz = undefined; // let the API detect
  }

  const base = getApiBaseUrl();
  const res = await fetchJSON<{ transcript?: string }>(`${base}/transcribe`, {
    method: 'POST',
    body: {
      contentBase64,
      encoding,
      languageCode,
      sampleRateHertz,
    },
    // Transcription can take a bit longer
    timeoutMs: 60000,
  });

  return res.transcript ?? '';
}

