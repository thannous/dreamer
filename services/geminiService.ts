/**
 * Conditional export for geminiService
 * Uses mock implementation if EXPO_PUBLIC_MOCK_MODE is enabled,
 * otherwise uses real implementation
 */

// Import both implementations
import * as realService from './geminiServiceReal';
import * as mockService from './mocks/geminiServiceMock';
import { isMockModeEnabled } from '@/lib/env';

// Export type that's shared between both implementations
export type { AnalysisResult } from './geminiServiceReal';

// Select which implementation to use based on environment
const isMockMode = isMockModeEnabled();
const service = isMockMode ? mockService : realService;

if (__DEV__) {
  if (isMockMode) {
    console.log('[GEMINI SERVICE] Using MOCK implementation');
  } else {
    console.log('[GEMINI SERVICE] Using REAL implementation');
  }
}

// Re-export all functions from the selected service
export const analyzeDream = service.analyzeDream;
export const categorizeDream = service.categorizeDream;
export const analyzeDreamWithImage = service.analyzeDreamWithImage;
export const analyzeDreamWithImageResilient = service.analyzeDreamWithImageResilient;
export const generateImageForDream = service.generateImageForDream;
export const generateImageFromTranscript = service.generateImageFromTranscript;
export const startOrContinueChat = service.startOrContinueChat;
export const resetChat = service.resetChat;
export const generateSpeechForText = service.generateSpeechForText;
