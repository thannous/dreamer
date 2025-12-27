import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

export const optimizeImage = async (
  image: { base64: string; contentType: string },
  options: { maxWidth?: number; maxHeight?: number; quality?: number; aspectRatio?: number } = {}
): Promise<{ base64: string; contentType: string }> => {
  const { maxWidth = 1024, maxHeight = 1024, quality = 78, aspectRatio } = options;
  const originalBase64 = image.base64;
  const originalContentType = image.contentType || 'image/png';

  try {
    const bytes = Uint8Array.from(atob(originalBase64), (c) => c.charCodeAt(0));
    const img = await Image.decode(bytes);
    if (aspectRatio && img.width > 0 && img.height > 0) {
      const currentAspect = img.width / img.height;
      if (currentAspect > aspectRatio) {
        const cropWidth = Math.max(1, Math.round(img.height * aspectRatio));
        const originX = Math.max(0, Math.round((img.width - cropWidth) / 2));
        img.crop(originX, 0, cropWidth, img.height);
      } else if (currentAspect < aspectRatio) {
        const cropHeight = Math.max(1, Math.round(img.width / aspectRatio));
        const originY = Math.max(0, Math.round((img.height - cropHeight) / 2));
        img.crop(0, originY, img.width, cropHeight);
      }
    }

    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    if (scale < 1) {
      img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    }

    const q = Math.min(100, Math.max(1, Math.round(quality)));
    const optimizedBytes = await img.encodeJPEG(q);
    return { base64: encodeBase64(optimizedBytes), contentType: 'image/jpeg' };
  } catch (err) {
    console.warn('[api] optimizeImage fallback (using original bytes)', err);
    return { base64: originalBase64, contentType: originalContentType };
  }
};
