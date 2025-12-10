import { describe, expect, it, vi } from 'vitest';

import { getThumbnailUrl, getImageConfig, THUMBNAIL_SIZE } from '../imageUtils';

describe('imageUtils', () => {
  describe('THUMBNAIL_SIZE', () => {
    it('is 160 pixels (80x80 display with 2x pixel density)', () => {
      expect(THUMBNAIL_SIZE).toBe(160);
    });
  });

  describe('getThumbnailUrl', () => {
    it('given empty url when getting thumbnail then returns empty url', () => {
      expect(getThumbnailUrl('')).toBe('');
    });

    it('given Imgur url when getting thumbnail then adds s suffix', () => {
      const url = 'https://i.imgur.com/abc123.jpg';
      const result = getThumbnailUrl(url);
      expect(result).toBe('https://i.imgur.com/abc123s.jpg');
    });

    it('given Imgur PNG when getting thumbnail then preserves extension', () => {
      const url = 'https://i.imgur.com/abc123.png';
      const result = getThumbnailUrl(url);
      expect(result).toBe('https://i.imgur.com/abc123s.png');
    });

    it('given Cloudinary url when getting thumbnail then adds transformation', () => {
      const url = 'https://res.cloudinary.com/demo/upload/sample.jpg';
      const result = getThumbnailUrl(url);
      expect(result).toContain('/upload/w_160,h_160,c_fill/');
    });

    it('given Cloudinary with custom size when getting thumbnail then uses custom size', () => {
      const url = 'https://res.cloudinary.com/demo/upload/sample.jpg';
      const result = getThumbnailUrl(url, 200);
      expect(result).toContain('/upload/w_200,h_200,c_fill/');
    });

    it('given Google Cloud Storage url when getting thumbnail then adds size param', () => {
      const url = 'https://storage.googleapis.com/bucket/image.jpg';
      const result = getThumbnailUrl(url);
      expect(result).toContain('size=160x160');
    });

    it('given Firebase Storage url when getting thumbnail then adds size param', () => {
      const url = 'https://firebasestorage.app/bucket/image.jpg';
      const result = getThumbnailUrl(url);
      expect(result).toContain('size=160x160');
    });

    it('given unsupported url when getting thumbnail then returns original', () => {
      const url = 'https://example.com/image.jpg';
      const result = getThumbnailUrl(url);
      expect(result).toBe(url);
    });

    it('given data url when getting thumbnail then returns original', () => {
      const dataUrl = 'data:image/png;base64,ABC123';
      const result = getThumbnailUrl(dataUrl);
      expect(result).toBe(dataUrl);
    });

    it('given malformed url when getting thumbnail then returns original', () => {
      const malformed = 'not-a-valid-url';
      const result = getThumbnailUrl(malformed);
      expect(result).toBe(malformed);
    });
  });

  describe('getImageConfig', () => {
    it('given thumbnail view when getting config then returns thumbnail settings', () => {
      const config = getImageConfig('thumbnail');

      expect(config.cachePolicy).toBe('memory-disk');
      expect(config.priority).toBe('normal');
      expect(config.transition).toBe(200);
      expect(config.contentFit).toBe('cover');
    });

    it('given full view when getting config then returns full settings', () => {
      const config = getImageConfig('full');

      expect(config.cachePolicy).toBe('memory-disk');
      expect(config.priority).toBe('high');
      expect(config.transition).toBe(300);
      expect(config.contentFit).toBe('cover');
    });
  });
});
