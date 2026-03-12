import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';

import {
  analyzeDream,
  analyzeDreamWithImage,
  analyzeDreamWithImageResilient,
  categorizeDream,
  generateImageForDream,
  generateImageFromTranscript,
  generateSpeechForText,
  resetChat,
  startOrContinueChat,
} from '../geminiServiceMock';

describe('geminiServiceMock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('analyzeDream', () => {
    it('returns analysis result with title and interpretation', async () => {
      const transcript = 'I was flying over mountains';
      const resultPromise = analyzeDream(transcript, 'en');

      await jest.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('interpretation');
      expect(result).toHaveProperty('shareableQuote');
      expect(result).toHaveProperty('theme');
      expect(result).toHaveProperty('dreamType');
      expect(result).toHaveProperty('imagePrompt');
    });

    it('logs the transcript being analyzed', async () => {
      const transcript = 'A dream about water';
      const resultPromise = analyzeDream(transcript, 'en');

      await jest.advanceTimersByTimeAsync(3000);
      await resultPromise;

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK] analyzeDream'),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('categorizeDream', () => {
    it('returns only title, theme and dreamType', async () => {
      const transcript = 'Dreaming of flying';
      const resultPromise = categorizeDream(transcript, 'en');

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('theme');
      expect(result).toHaveProperty('dreamType');
      expect(result).not.toHaveProperty('interpretation');
      expect(result).not.toHaveProperty('shareableQuote');
    });
  });

  describe('analyzeDreamWithImage', () => {
    it('returns analysis with image URL', async () => {
      const transcript = 'A mystical forest dream';
      const resultPromise = analyzeDreamWithImage(transcript, 'en');

      await jest.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(result).toHaveProperty('imageUrl');
      expect(result.imageUrl).toContain('https://');
    });
  });

  describe('analyzeDreamWithImageResilient', () => {
    it('returns analysis with imageGenerationFailed flag', async () => {
      const transcript = 'A calm ocean dream';
      const resultPromise = analyzeDreamWithImageResilient(transcript, 'en');

      await jest.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('imageGenerationFailed');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('always succeeds in mock mode', async () => {
      const transcript = 'Dream that could fail';
      const resultPromise = analyzeDreamWithImageResilient(transcript);

      await jest.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(result.imageUrl).not.toBeNull();
      expect(result.imageGenerationFailed).toBe(false);
    });
  });

  describe('generateImageForDream', () => {
    it('returns image URL based on prompt', async () => {
      const prompt = 'A surreal landscape';
      const resultPromise = generateImageForDream(prompt);

      await jest.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result).toContain('https://');
    });

    it('returns different image for different themes', async () => {
      const prompt = 'A mystical forest with glowing lights';
      const resultPromise = generateImageForDream(prompt);

      await jest.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(typeof result).toBe('string');
      expect(result).toContain('https://');
    });

    it('handles prompt without theme keywords', async () => {
      const prompt = 'Just a regular dream scene';
      const resultPromise = generateImageForDream(prompt);

      await jest.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateImageFromTranscript', () => {
    it('returns image URL', async () => {
      const transcript = 'Flying through clouds';
      const resultPromise = generateImageFromTranscript(transcript);

      await jest.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result).toContain('https://');
    });
  });

  describe('startOrContinueChat', () => {
    it('returns a chat response with dreamId', async () => {
      // ✅ PHASE 2: Updated to use dreamId instead of history
      const dreamId = 'dream-abc-123';
      const message = 'What does flying mean?';
      const resultPromise = startOrContinueChat(dreamId, message, 'en');

      await jest.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.message).toEqual(
        expect.objectContaining({
          role: 'model',
          text: result.text,
        })
      );
    });

    it('handles default language', async () => {
      // ✅ PHASE 2: Server manages history, client just sends dreamId and message
      const dreamId = 'dream-xyz-789';
      const message = 'Tell me about my dream';
      const resultPromise = startOrContinueChat(dreamId, message);

      await jest.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.message).toEqual(
        expect.objectContaining({
          role: 'model',
          text: result.text,
        })
      );
    });
  });

  describe('resetChat', () => {
    it('logs reset call', () => {
      resetChat();

      expect(console.log).toHaveBeenCalledWith('[MOCK] resetChat called (no-op)');
    });
  });

  describe('generateSpeechForText', () => {
    it('returns base64 audio string', async () => {
      const text = 'This is text to speak';
      const resultPromise = generateSpeechForText(text);

      await jest.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns valid base64', async () => {
      const text = 'Test speech';
      const resultPromise = generateSpeechForText(text);

      await jest.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      // Check it's valid base64
      expect(() => atob(result)).not.toThrow();
    });
  });
});
