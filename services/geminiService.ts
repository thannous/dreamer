// Backend proxy integration for RN app. Configure base URL via EXPO_PUBLIC_API_URL
// or app.json extra.apiUrl. Endpoints expected:
// - POST /analyzeDream { transcript } -> AnalysisResult
// - POST /generateImage { prompt } -> { imageUrl?: string, imageBytes?: string }
// - POST /chat { history, message, lang } -> { text: string }
// - POST /tts { text } -> { audioBase64: string }

import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';

export type AnalysisResult = {
  title: string;
  interpretation: string;
  shareableQuote: string;
  theme: 'surreal' | 'mystical' | 'calm' | 'noir';
  dreamType: string;
  imagePrompt: string;
};

export async function analyzeDream(transcript: string): Promise<AnalysisResult> {
  const base = getApiBaseUrl();
  return fetchJSON<AnalysisResult>(`${base}/analyzeDream`, {
    method: 'POST',
    body: { transcript },
  });
}

export async function generateImageForDream(prompt: string): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string }>(`${base}/generateImage`, {
    method: 'POST',
    body: { prompt },
  });
  if (res.imageUrl) return res.imageUrl;
  if (res.imageBytes) return `data:image/jpeg;base64,${res.imageBytes}`;
  throw new Error('Invalid image response from backend');
}

export async function startOrContinueChat(
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  lang: string,
): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<{ text: string }>(`${base}/chat`, {
    method: 'POST',
    body: { history, message, lang },
  });
  return res.text;
}

export function resetChat() {
  // stateless backend; nothing to do here
}

export async function generateSpeechForText(text: string): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<{ audioBase64: string }>(`${base}/tts`, {
    method: 'POST',
    body: { text },
    timeoutMs: 60000,
  });
  if (!res.audioBase64) throw new Error('No audio returned');
  return res.audioBase64;
}
