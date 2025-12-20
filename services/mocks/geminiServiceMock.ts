/**
 * Mock implementation of geminiService for development mode
 * Simulates API calls with realistic delays and data
 */

import { getRandomImageForTheme } from '@/mock-data/assets';
import { generateAnalysisResult, generateChatResponse } from '@/mock-data/generators';

import type { ChatMessage, DreamTheme, DreamType, ReferenceImageGenerationRequest } from '@/lib/types';

import type { AnalysisResult, CategorizeDreamResult } from '../geminiServiceReal';

export type { AnalysisResult, CategorizeDreamResult } from '../geminiServiceReal';

/**
 * Simulate network delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock dream analysis (1-3 seconds)
 */
export async function analyzeDream(
  transcript: string,
  lang = 'en',
  _fingerprint?: string
): Promise<AnalysisResult> {
  console.log('[MOCK] analyzeDream called with transcript:', transcript.slice(0, 50) + '...', 'lang:', lang);
  await delay(1000 + Math.random() * 2000); // 1-3 seconds

  const result = generateAnalysisResult(transcript);
  console.log('[MOCK] analyzeDream returning:', result.title);
  return result;
}

/**
 * Mock fast categorization (0.5-1 second)
 * Now includes hasPerson/hasAnimal detection
 */
export async function categorizeDream(
  transcript: string,
  lang = 'en'
): Promise<CategorizeDreamResult> {
  console.log('[MOCK] categorizeDream called with transcript:', transcript.slice(0, 50) + '...', 'lang:', lang);
  await delay(500 + Math.random() * 500); // 0.5-1 second

  const result = generateAnalysisResult(transcript);

  // Simulate subject detection based on transcript content
  const transcriptLower = transcript.toLowerCase();
  const hasPerson = transcriptLower.includes('person') ||
    transcriptLower.includes('friend') ||
    transcriptLower.includes('family') ||
    transcriptLower.includes('mother') ||
    transcriptLower.includes('father') ||
    transcriptLower.includes('sister') ||
    transcriptLower.includes('brother') ||
    transcriptLower.includes('someone') ||
    Math.random() > 0.7; // 30% chance randomly

  const hasAnimal = transcriptLower.includes('animal') ||
    transcriptLower.includes('dog') ||
    transcriptLower.includes('cat') ||
    transcriptLower.includes('bird') ||
    transcriptLower.includes('horse') ||
    transcriptLower.includes('creature') ||
    Math.random() > 0.85; // 15% chance randomly

  console.log('[MOCK] categorizeDream returning:', result.title, { hasPerson, hasAnimal });
  return {
    title: result.title,
    theme: result.theme,
    dreamType: result.dreamType,
    hasPerson,
    hasAnimal,
  };
}

/**
 * Mock combined analysis + image generation (3-5 seconds)
 */
export async function analyzeDreamWithImage(
  transcript: string,
  lang = 'en',
  _fingerprint?: string
): Promise<AnalysisResult & { imageUrl: string }> {
  console.log('[MOCK] analyzeDreamWithImage called with lang:', lang);
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
  transcript: string,
  lang = 'en',
  _fingerprint?: string
): Promise<AnalysisResult & { imageUrl: string | null; imageGenerationFailed: boolean }> {
  console.log('[MOCK] analyzeDreamWithImageResilient called with lang:', lang);

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
export async function generateImageForDream(prompt: string, _previousImageUrl?: string): Promise<string> {
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

export async function generateImageFromTranscript(transcript: string, _previousImageUrl?: string): Promise<string> {
  console.log('[MOCK] generateImageFromTranscript called with transcript:', transcript.slice(0, 50) + '...');
  await delay(2000 + Math.random() * 2000); // 2-4 seconds
  const imageUrl = getRandomImageForTheme('surreal');
  console.log('[MOCK] generateImageFromTranscript returning:', imageUrl);
  return imageUrl;
}

/**
 * ✅ PHASE 2: Mock chat conversation with quota enforcement (1-2 seconds)
 *
 * UPDATED: Now requires dreamId (for ownership + quota enforcement)
 * In mock mode, quota is handled by GuestAnalysisCounter or MockQuotaEventStore
 */
export async function startOrContinueChat(
  dreamId: string,
  message: string,
  lang: string = 'en',
  _dreamContext?: {
    transcript: string;
    title: string;
    interpretation: string;
    shareableQuote: string;
    dreamType: DreamType;
    theme?: DreamTheme;
    chatHistory?: ChatMessage[];
  },
  _fingerprint?: string,
): Promise<string> {
  console.log('[MOCK] startOrContinueChat called with dreamId:', dreamId, 'message:', message);
  await delay(1000 + Math.random() * 1000); // 1-2 seconds

  // In mock mode, generate response based on message
  // Server-side quota tracking is handled by quota service
  const response = generateChatResponse(message, 'your dream');

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

/**
 * Mock image generation with reference subjects (3-5 seconds)
 * Returns a placeholder image regardless of reference images
 */
export async function generateImageWithReference(
  request: ReferenceImageGenerationRequest
): Promise<string> {
  const promptText = request.prompt ?? request.transcript;
  console.log('[MOCK] generateImageWithReference called with', {
    transcriptLength: request.transcript.length,
    promptLength: promptText.length,
    referenceCount: request.referenceImages.length,
    subjectTypes: request.referenceImages.map(img => img.type),
  });

  await delay(3000 + Math.random() * 2000); // 3-5 seconds

  // Return a random placeholder image
  const imageUrl = getRandomImageForTheme('surreal');

  console.log('[MOCK] generateImageWithReference returning:', imageUrl);
  return imageUrl;
}
