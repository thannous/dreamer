/**
 * Mock implementation of geminiService for development mode
 * Simulates API calls with realistic delays and data
 */

import type { DreamTheme, DreamType } from '@/lib/types';
import { getRandomImageForTheme } from '@/mock-data/assets';
import { generateAnalysisResult, generateChatResponse } from '@/mock-data/generators';

export type AnalysisResult = {
  title: string;
  interpretation: string;
  shareableQuote: string;
  theme: DreamTheme;
  dreamType: DreamType;
  imagePrompt: string;
};

/**
 * Simulate network delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock dream analysis (1-3 seconds)
 */
export async function analyzeDream(transcript: string): Promise<AnalysisResult> {
  console.log('[MOCK] analyzeDream called with transcript:', transcript.slice(0, 50) + '...');
  await delay(1000 + Math.random() * 2000); // 1-3 seconds

  const result = generateAnalysisResult(transcript);
  console.log('[MOCK] analyzeDream returning:', result.title);
  return result;
}

/**
 * Mock fast categorization (0.5-1 second)
 */
export async function categorizeDream(transcript: string): Promise<Pick<AnalysisResult, 'title' | 'theme' | 'dreamType'>> {
  console.log('[MOCK] categorizeDream called with transcript:', transcript.slice(0, 50) + '...');
  await delay(500 + Math.random() * 500); // 0.5-1 second

  const result = generateAnalysisResult(transcript);
  console.log('[MOCK] categorizeDream returning:', result.title);
  return {
    title: result.title,
    theme: result.theme,
    dreamType: result.dreamType,
  };
}

/**
 * Mock combined analysis + image generation (3-5 seconds)
 */
export async function analyzeDreamWithImage(transcript: string): Promise<AnalysisResult & { imageUrl: string }> {
  console.log('[MOCK] analyzeDreamWithImage called');
  await delay(3000 + Math.random() * 2000); // 3-5 seconds

  const result = generateAnalysisResult(transcript);
  const imageUrl = getRandomImageForTheme(result.theme);

  console.log('[MOCK] analyzeDreamWithImage returning with image');
  return { ...result, imageUrl };
}

/**
 * Mock resilient analysis with image
 * Always succeeds in mock mode (no failures to simulate)
 */
export async function analyzeDreamWithImageResilient(
  transcript: string
): Promise<AnalysisResult & { imageUrl: string | null; imageGenerationFailed: boolean }> {
  console.log('[MOCK] analyzeDreamWithImageResilient called');

  // Simulate progressive delay (analysis phase)
  await delay(2000);
  const result = generateAnalysisResult(transcript);

  // Simulate image generation phase
  await delay(2000 + Math.random() * 1000); // Additional 2-3 seconds
  const imageUrl = getRandomImageForTheme(result.theme);

  console.log('[MOCK] analyzeDreamWithImageResilient returning with image:', imageUrl);
  return {
    ...result,
    imageUrl,
    imageGenerationFailed: false
  };
}

/**
 * Mock image generation for dream (2-4 seconds)
 */
export async function generateImageForDream(prompt: string): Promise<string> {
  console.log('[MOCK] generateImageForDream called with prompt:', prompt.slice(0, 50) + '...');
  await delay(2000 + Math.random() * 2000); // 2-4 seconds

  // Extract theme from prompt if possible, otherwise use random
  const themes: DreamTheme[] = ['surreal', 'mystical', 'calm', 'noir'];
  let theme: DreamTheme = 'surreal';

  for (const t of themes) {
    if (prompt.toLowerCase().includes(t)) {
      theme = t;
      break;
    }
  }

  const imageUrl = getRandomImageForTheme(theme);
  console.log('[MOCK] generateImageForDream returning:', imageUrl);
  return imageUrl;
}

export async function generateImageFromTranscript(transcript: string): Promise<string> {
  console.log('[MOCK] generateImageFromTranscript called with transcript:', transcript.slice(0, 50) + '...');
  await delay(2000 + Math.random() * 2000); // 2-4 seconds
  const imageUrl = getRandomImageForTheme('surreal');
  console.log('[MOCK] generateImageFromTranscript returning:', imageUrl);
  return imageUrl;
}

/**
 * Mock chat conversation (1-2 seconds)
 */
export async function startOrContinueChat(
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  lang: string,
): Promise<string> {
  console.log('[MOCK] startOrContinueChat called with message:', message);
  await delay(1000 + Math.random() * 1000); // 1-2 seconds

  // Get dream context from history if available
  const dreamContext = history.length > 0 ? history[0].text : 'your dream';
  const response = generateChatResponse(message, dreamContext);

  console.log('[MOCK] startOrContinueChat returning response');
  return response;
}

/**
 * Mock reset chat (instant)
 */
export function resetChat() {
  console.log('[MOCK] resetChat called (no-op)');
  // No-op in mock mode
}

/**
 * Mock text-to-speech generation (2-3 seconds)
 * Returns a dummy base64 audio string
 */
export async function generateSpeechForText(text: string): Promise<string> {
  console.log('[MOCK] generateSpeechForText called with text:', text.slice(0, 50) + '...');
  await delay(2000 + Math.random() * 1000); // 2-3 seconds

  // Return a minimal valid base64 audio string (empty WAV file header)
  // In real usage, audio playback will fail gracefully or you can use a real sample
  const dummyAudioBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA=';

  console.log('[MOCK] generateSpeechForText returning dummy audio');
  return dummyAudioBase64;
}
