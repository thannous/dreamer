import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock config to use our test URL
jest.mock('../../lib/config', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

// Mock auth to avoid supabase dependency
const mockGetAccessToken = jest.fn();
jest.mock('../../lib/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

const mockGetGuestHeaders = jest.fn();
const mockInvalidateGuestSession = jest.fn();

jest.mock('../../lib/guestSession', () => ({
  getGuestHeaders: () => mockGetGuestHeaders(),
  invalidateGuestSession: () => mockInvalidateGuestSession(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
      },
    },
  },
}));

const {
  analyzeDream,
  analyzeDreamWithImage,
  analyzeDreamWithImageResilient,
  categorizeDream,
  generateImageForDream,
  generateImageFromTranscript,
  getImageGenerationJobStatus,
  generateSpeechForText,
  resetChat,
  submitImageGenerationJob,
  startOrContinueChat,
} = require('../geminiServiceReal');


const buildAnalysisResult = (overrides = {}) => ({
  title: 'Dream Title',
  interpretation: 'Dream interpretation text',
  shareableQuote: 'A shareable quote',
  theme: 'mystical' as const,
  dreamType: 'Lucid Dream' as const,
  imagePrompt: 'A mystical dream scene',
  ...overrides,
});

// Helper to create a mock fetch response
const mockFetchResponse = (data: unknown, ok = true, status = 200, statusText = 'OK') => {
  return Promise.resolve({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

describe('geminiServiceReal', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue(null);
    mockGetGuestHeaders.mockResolvedValue({});
    mockInvalidateGuestSession.mockResolvedValue(undefined);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('analyzeDream', () => {
    it('sends POST request to /analyzeDream with transcript and lang', async () => {
      const mockResult = buildAnalysisResult();
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse(mockResult));

      const result = await analyzeDream('I was flying', 'en');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/analyzeDream',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transcript: 'I was flying', lang: 'en' }),
        })
      );
      expect(result).toEqual(mockResult);
    });

    it('uses default language when not provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(buildAnalysisResult())
      );

      await analyzeDream('Test dream');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Test dream', lang: 'en' }),
        })
      );
    });

    it('includes fingerprint when provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(buildAnalysisResult())
      );

      await analyzeDream('Test dream', 'fr', 'fingerprint-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Test dream', lang: 'fr', fingerprint: 'fingerprint-123' }),
        })
      );
    });

    it('does not include fingerprint when undefined', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(buildAnalysisResult())
      );

      await analyzeDream('Test dream', 'en', undefined);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Test dream', lang: 'en' }),
        })
      );
    });

    it('uses bearer auth for signed-in requests without requiring guest headers', async () => {
      mockGetAccessToken.mockResolvedValue('user-token');
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(buildAnalysisResult())
      );

      await analyzeDream('Authenticated dream');

      expect(mockGetGuestHeaders).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/analyzeDream',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer user-token',
          }),
        })
      );
    });
  });

  describe('categorizeDream', () => {
    it('sends POST request to /categorizeDream', async () => {
      const mockResult = { title: 'Dream', theme: 'adventure' as const, dreamType: 'Nightmare' as const };
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse(mockResult));

      const result = await categorizeDream('Flying dream', 'es');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/categorizeDream',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transcript: 'Flying dream', lang: 'es' }),
        })
      );
      expect(result).toEqual(mockResult);
    });

    it('uses default language when not provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ title: 'T', theme: 'mystical', dreamType: 'Lucid Dream' })
      );

      await categorizeDream('Dream');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Dream', lang: 'en' }),
        })
      );
    });
  });

  describe('analyzeDreamWithImage', () => {
    it('sends POST to /analyzeDreamFull', async () => {
      const mockResult = { ...buildAnalysisResult(), imageUrl: 'https://img.example.com/dream.jpg' };
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse(mockResult));

      const result = await analyzeDreamWithImage('Dream transcript', 'en');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/analyzeDreamFull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transcript: 'Dream transcript', lang: 'en' }),
        })
      );
      expect(result.imageUrl).toBe('https://img.example.com/dream.jpg');
    });

    it('converts imageBytes to data URL when imageUrl not provided', async () => {
      const mockResult = { ...buildAnalysisResult(), imageBytes: 'base64encodeddata' };
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse(mockResult));

      const result = await analyzeDreamWithImage('Dream', 'en');

      expect(result.imageUrl).toBe('data:image/webp;base64,base64encodeddata');
    });

    it('throws error when neither imageUrl nor imageBytes provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(buildAnalysisResult())
      );

      await expect(analyzeDreamWithImage('Dream', 'en')).rejects.toThrow(
        'Invalid combined response from backend'
      );
    });

    it('includes fingerprint when provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ ...buildAnalysisResult(), imageUrl: 'https://img.test.com' })
      );

      await analyzeDreamWithImage('Dream', 'en', 'fp-456');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Dream', lang: 'en', fingerprint: 'fp-456' }),
        })
      );
    });
  });

  describe('analyzeDreamWithImageResilient', () => {
    it('returns result with imageUrl when combined call succeeds', async () => {
      const mockResult = { ...buildAnalysisResult(), imageUrl: 'https://img.example.com/dream.jpg' };
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse(mockResult));

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(result.imageUrl).toBe('https://img.example.com/dream.jpg');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('converts imageBytes to data URL in combined response', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ ...buildAnalysisResult(), imageBytes: 'abc123' })
      );

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(result.imageUrl).toBe('data:image/webp;base64,abc123');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('tries separate image generation when combined returns no image', async () => {
      // First call: combined returns analysis without image
      (global.fetch as ReturnType<typeof jest.fn>)
        .mockReturnValueOnce(mockFetchResponse(buildAnalysisResult()))
        // Second call: separate image generation succeeds
        .mockReturnValueOnce(mockFetchResponse({ imageUrl: 'https://separate.img.com/dream.jpg' }));

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.imageUrl).toBe('https://separate.img.com/dream.jpg');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('returns null imageUrl when separate image generation fails', async () => {
      // First call: combined returns analysis without image
      (global.fetch as ReturnType<typeof jest.fn>)
        .mockReturnValueOnce(mockFetchResponse(buildAnalysisResult()))
        // Second call: separate image generation fails (no imageUrl/imageBytes)
        .mockReturnValueOnce(mockFetchResponse({}));

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(result.imageUrl).toBeNull();
      expect(result.imageGenerationFailed).toBe(true);
    });

    it('falls back to analysis-only when combined call fails', async () => {
      // First call: combined fails
      (global.fetch as ReturnType<typeof jest.fn>)
        .mockReturnValueOnce(mockFetchResponse({ error: 'Combined failed' }, false, 500))
        // Second call: analysis-only succeeds
        .mockReturnValueOnce(mockFetchResponse(buildAnalysisResult()))
        // Third call: separate image succeeds
        .mockReturnValueOnce(mockFetchResponse({ imageUrl: 'https://fallback.img.com' }));

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result.imageUrl).toBe('https://fallback.img.com');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('returns analysis without image when fallback image generation fails', async () => {
      // First call: combined fails
      (global.fetch as ReturnType<typeof jest.fn>)
        .mockReturnValueOnce(mockFetchResponse({ error: 'Combined failed' }, false, 500))
        // Second call: analysis-only succeeds
        .mockReturnValueOnce(mockFetchResponse(buildAnalysisResult()))
        // Third call: separate image fails
        .mockReturnValueOnce(mockFetchResponse({}, false, 500));

      const result = await analyzeDreamWithImageResilient('Dream', 'en');

      expect(result.title).toBe('Dream Title');
      expect(result.imageUrl).toBeNull();
      expect(result.imageGenerationFailed).toBe(true);
    });

    it('throws when both combined and analysis-only fail', async () => {
      // First call: combined fails
      (global.fetch as ReturnType<typeof jest.fn>)
        .mockReturnValueOnce(mockFetchResponse({ error: 'Combined failed' }, false, 500))
        // Second call: analysis-only fails too
        .mockReturnValueOnce(mockFetchResponse({ error: 'Analysis failed' }, false, 500));

      await expect(analyzeDreamWithImageResilient('Dream', 'en')).rejects.toThrow();
    });

    it('includes fingerprint when provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ ...buildAnalysisResult(), imageUrl: 'https://img.test.com' })
      );

      await analyzeDreamWithImageResilient('Dream', 'en', 'fp-789');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'Dream', lang: 'en', fingerprint: 'fp-789' }),
        })
      );
    });
  });

  describe('generateImageForDream', () => {
    it('sends POST to /generateImage with prompt', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageUrl: 'https://gen.img.com/dream.jpg' })
      );

      const result = await generateImageForDream('mystical forest scene');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/generateImage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ prompt: 'mystical forest scene' }),
        })
      );
      expect(result).toBe('https://gen.img.com/dream.jpg');
    });

    it('includes previousImageUrl when provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageUrl: 'https://gen.img.com/new.jpg' })
      );

      await generateImageForDream('new scene', 'https://old.img.com/old.jpg');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ prompt: 'new scene', previousImageUrl: 'https://old.img.com/old.jpg' }),
        })
      );
    });

    it('converts imageBytes to data URL', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageBytes: 'imgdatabase64' })
      );

      const result = await generateImageForDream('prompt');

      expect(result).toBe('data:image/webp;base64,imgdatabase64');
    });

    it('throws error when no image returned', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse({}));

      await expect(generateImageForDream('prompt')).rejects.toThrow(
        'Invalid image response from backend'
      );
    });

    it('throws a classified message when content is blocked', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(
          { error: 'Blocked by policy', blockReason: 'safety' },
          false,
          400,
          'Bad Request'
        )
      );

      await expect(generateImageForDream('prompt')).rejects.toThrow(
        'This dream\'s imagery couldn\'t be generated due to content guidelines.'
      );
    });
  });

  describe('generateImageFromTranscript', () => {
    it('sends POST to /generateImage with transcript', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageUrl: 'https://gen.img.com/transcript.jpg' })
      );

      const result = await generateImageFromTranscript('I dreamed of flying');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/generateImage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transcript: 'I dreamed of flying' }),
        })
      );
      expect(result).toBe('https://gen.img.com/transcript.jpg');
    });

    it('includes previousImageUrl when provided', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageUrl: 'https://gen.img.com/new.jpg' })
      );

      await generateImageFromTranscript('new dream', 'https://prev.img.com');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transcript: 'new dream', previousImageUrl: 'https://prev.img.com' }),
        })
      );
    });

    it('converts imageBytes to data URL', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ imageBytes: 'transcriptimgdata' })
      );

      const result = await generateImageFromTranscript('dream');

      expect(result).toBe('data:image/webp;base64,transcriptimgdata');
    });

    it('throws error when no image returned', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ prompt: 'only prompt returned' })
      );

      await expect(generateImageFromTranscript('dream')).rejects.toThrow(
        'Invalid image response from backend'
      );
    });

    it('throws a classified message when image generation is blocked', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse(
          { error: 'No inlineData', finishReason: 'IMAGE_OTHER' },
          false,
          429,
          'Too Many Requests'
        )
      );

      await expect(generateImageFromTranscript('dream')).rejects.toThrow(
        'The image service is temporarily busy. Your dream has been saved and you can retry later.'
      );
    });
  });

  describe('image job endpoints', () => {
    it('submits an image job command', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({
          jobId: 'job-123',
          status: 'queued',
          clientRequestId: 'request-123',
        }, true, 202, 'Accepted')
      );

      const result = await submitImageGenerationJob({
        clientRequestId: 'request-123',
        transcript: 'I dreamed of flying',
        previousImageUrl: 'https://old.example.com/image.jpg',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/image-jobs',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            clientRequestId: 'request-123',
            transcript: 'I dreamed of flying',
            previousImageUrl: 'https://old.example.com/image.jpg',
          }),
        })
      );
      expect(result).toEqual({
        jobId: 'job-123',
        status: 'queued',
        clientRequestId: 'request-123',
      });
    });

    it('reads image job status', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({
          jobId: 'job-123',
          status: 'succeeded',
          clientRequestId: 'request-123',
          resultPayload: {
            imageUrl: 'https://img.example.com/generated.jpg',
          },
        })
      );

      const result = await getImageGenerationJobStatus('job-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/image-jobs/status',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ jobId: 'job-123' }),
        })
      );
      expect(result.resultPayload?.imageUrl).toBe('https://img.example.com/generated.jpg');
    });
  });

  describe('startOrContinueChat', () => {
    it('sends POST to /chat with dreamId and message', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ text: 'AI response' })
      );

      // ✅ PHASE 2: Updated to use dreamId instead of history
      const dreamId = 'dream-123';
      const result = await startOrContinueChat(dreamId, 'What does water mean?', 'en');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ dreamId, message: 'What does water mean?', lang: 'en' }),
        })
      );
      expect(result).toEqual({ text: 'AI response' });
    });

    it('handles default language', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ text: 'First response' })
      );

      // ✅ PHASE 2: Server manages history, client just sends dreamId and message
      const dreamId = 'dream-456';
      const result = await startOrContinueChat(dreamId, 'First message');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ dreamId, message: 'First message', lang: 'en' }),
        })
      );
      expect(result).toEqual({ text: 'First response' });
    });
  });

  describe('resetChat', () => {
    it('is a no-op function (stateless backend)', () => {
      // Should not throw and should return undefined
      expect(resetChat()).toBeUndefined();
    });
  });

  describe('generateSpeechForText', () => {
    it('sends POST to /tts with text', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(
        mockFetchResponse({ audioBase64: 'base64audiodata' })
      );

      const result = await generateSpeechForText('Read this text aloud');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/tts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Read this text aloud' }),
        })
      );
      expect(result).toBe('base64audiodata');
    });

    it('throws error when no audio returned', async () => {
      (global.fetch as ReturnType<typeof jest.fn>).mockReturnValue(mockFetchResponse({}));

      await expect(generateSpeechForText('text')).rejects.toThrow('No audio returned');
    });
  });
});
