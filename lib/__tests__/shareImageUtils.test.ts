import { describe, expect, it } from 'vitest';

import { getFileExtensionFromUrl, getMimeTypeFromExtension } from '@/lib/journal/shareImageUtils';

describe('shareImageUtils', () => {
  it('[B] Given a jpeg URL with query When extracting extension Then it normalizes to jpg', () => {
    // Given
    const url = 'https://cdn.example.com/image.jpeg?size=large';

    // When
    const extension = getFileExtensionFromUrl(url);
    const mime = getMimeTypeFromExtension(extension);

    // Then
    expect(extension).toBe('jpg');
    expect(mime).toBe('image/jpeg');
  });

  it('[E] Given a URL without extension When extracting Then it falls back to jpg', () => {
    // Given
    const url = 'https://cdn.example.com/image';

    // When
    const extension = getFileExtensionFromUrl(url);
    const mime = getMimeTypeFromExtension('tiff');

    // Then
    expect(extension).toBe('jpg');
    expect(mime).toBe('image/jpeg');
  });
});

