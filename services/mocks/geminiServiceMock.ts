import { selfHarmSupportReply } from '@/supabase/functions/api/lib/selfHarmSupport';
/**
 * Mock implementation of geminiService for development mode
 * Simulates API calls with realistic delays and data
 */

import { getRandomImageForTheme } from '@/mock-data/assets';
import { getMockCategorizationDelayMs } from '@/lib/env';
import { generateAnalysisResult, generateChatResponse } from '@/mock-data/generators';

import type { ChatMessage, DreamTheme, DreamType } from '@/lib/types';

import type {
  AnalysisJobCommandRequest,
  AnalysisJobCommandResponse,
  AnalysisJobStatusResponse,
  AnalysisResult,
  AnalysisRequestContext,
  CategorizeDreamResult,
  ImageJobCommandRequest,
  ImageJobCommandResponse,
  ImageJobStatusResponse,
} from '../geminiServiceReal';

export type { AnalysisResult, CategorizeDreamResult } from '../geminiServiceReal';

const mockImageJobs = new Map<
  string,
  {
    createdAt: number;
    clientRequestId: string;
    imageUrl: string;
  }
>();

const mockAnalysisJobs = new Map<
  string,
  { createdAt: number; clientRequestId: string; dreamId: number }
>();

/**
 * Simulate network delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fixed analysis duration so the loading experience stays visible in mock mode.
const MOCK_ANALYSIS_DURATION_MS = 5000;

/**
 * Mock dream analysis (fixed 5 seconds)
 */
export async function analyzeDream(
  transcript: string,
  lang = 'en',
  _fingerprint?: string,
  _context?: AnalysisRequestContext
): Promise<AnalysisResult> {
  console.log('[MOCK] analyzeDream called with transcript:', transcript.slice(0, 50) + '...', 'lang:', lang);
  await delay(MOCK_ANALYSIS_DURATION_MS);

  const result = generateAnalysisResult(transcript, lang);
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
  await delay(getMockCategorizationDelayMs() ?? (500 + Math.random() * 500)); // Normal profile: 0.5-1 second.

  const result = generateAnalysisResult(transcript, lang);

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

export async function submitImageGenerationJob(
  request: ImageJobCommandRequest
): Promise<ImageJobCommandResponse> {
  await delay(150);
  const jobId = `mock-image-job-${request.clientRequestId}`;
  mockImageJobs.set(jobId, {
    createdAt: Date.now(),
    clientRequestId: request.clientRequestId,
    imageUrl: getRandomImageForTheme('surreal'),
  });
  return {
    jobId,
    status: 'queued',
    clientRequestId: request.clientRequestId,
  };
}

export async function getImageGenerationJobStatus(jobId: string): Promise<ImageJobStatusResponse> {
  await delay(120);
  const job = mockImageJobs.get(jobId);
  if (!job) {
    throw Object.assign(new Error('Job not found'), { status: 404 });
  }

  const elapsed = Date.now() - job.createdAt;
  if (elapsed < 600) {
    return {
      jobId,
      status: 'queued',
      clientRequestId: job.clientRequestId,
    };
  }

  if (elapsed < 1200) {
    return {
      jobId,
      status: 'running',
      clientRequestId: job.clientRequestId,
    };
  }

  return {
    jobId,
    status: 'succeeded',
    clientRequestId: job.clientRequestId,
    resultPayload: {
      imageUrl: job.imageUrl,
    },
  };
}

export async function submitDreamAnalysisJob(
  request: AnalysisJobCommandRequest
): Promise<AnalysisJobCommandResponse> {
  await delay(150);
  const jobId = `mock-analysis-job-${request.analysisRequestId}`;
  mockAnalysisJobs.set(jobId, {
    createdAt: Date.now(),
    clientRequestId: request.analysisRequestId,
    dreamId: request.dreamId,
  });
  return {
    jobId,
    status: 'queued',
    clientRequestId: request.analysisRequestId,
  };
}

export async function getDreamAnalysisJobStatus(
  jobId: string
): Promise<AnalysisJobStatusResponse> {
  await delay(120);
  const job = mockAnalysisJobs.get(jobId);
  if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });

  const status = Date.now() - job.createdAt < 600 ? 'running' : 'succeeded';
  return {
    jobId,
    status,
    clientRequestId: job.clientRequestId,
    ...(status === 'succeeded' ? { resultPayload: { dreamId: job.dreamId } } : {}),
  };
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
  _options?: {
    signal?: AbortSignal;
    clientRequestId?: string;
    messageMeta?: ChatMessage['meta'];
    onDelta?: (accumulated: string) => void;
  },
): Promise<{ text: string; message: Partial<ChatMessage> }> {
  console.log('[MOCK] startOrContinueChat called with dreamId:', dreamId, 'message:', message);
  await delay(1000 + Math.random() * 1000); // 1-2 seconds

  // In mock mode, generate response based on message
  // Server-side quota tracking is handled by quota service
  const supportReply = selfHarmSupportReply(message, lang);
  const response = supportReply ?? generateChatResponse(message, 'your dream');

  if (_options?.onDelta && !supportReply) {
    // Simulate streaming: reveal the reply a few words at a time.
    const words = response.split(' ');
    let accumulated = '';
    for (let i = 0; i < words.length; i += 3) {
      accumulated += (accumulated ? ' ' : '') + words.slice(i, i + 3).join(' ');
      _options.onDelta(accumulated);
      await delay(60);
    }
  }

  console.log('[MOCK] startOrContinueChat returning response');
  return {
    text: response,
    message: {
      id: `mock-chat-${Date.now()}`,
      role: 'model',
      text: response,
      parts: [{ text: response }],
    },
  };
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
