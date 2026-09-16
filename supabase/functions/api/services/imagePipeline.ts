import { callGeminiWithFallback } from './gemini.ts';
import { generateImageFromPrompt, resolveImagePromptModel } from './geminiImages.ts';
import type { ImageResolution } from './geminiImages.ts';
import { optimizeImage } from './image.ts';
import { createStorageHelpers } from './storage.ts';

type ImagePromptOptions = {
  apiKey: string;
  prompt?: string | null;
  transcript?: string | null;
};

type StoredImageOptions = {
  apiKey: string;
  model: string;
  prompt: string;
  previousImageUrl?: string | null;
  supabaseUrl: string;
  supabaseServiceRoleKey: string | null;
  storageBucket: string;
  ownerId: string;
  imageSize?: ImageResolution;
};

export async function prepareIllustrationForStorage(
  image: { base64: string; contentType: string }, resolution: ImageResolution = '1K'
) {
  if (resolution === '2K' || resolution === '4K') return image;
  return (await optimizeImage(image, { maxWidth: 1024, maxHeight: 1024, quality: 78, aspectRatio: 9 / 16 })
    .catch(() => null)) ?? image;
}

export async function ensureImagePrompt(options: ImagePromptOptions): Promise<string> {
  const prompt = String(options.prompt ?? '').trim();
  if (prompt) {
    return prompt;
  }

  const transcript = String(options.transcript ?? '').trim();
  if (!transcript) {
    throw new Error('Missing prompt or transcript');
  }

  const promptModel = resolveImagePromptModel();
  const { text: generatedPrompt } = await callGeminiWithFallback(
    options.apiKey,
    promptModel,
    promptModel,
    [
      {
        role: 'user',
        parts: [
          {
            text: `Generate a short, vivid, artistic image prompt (max 40 words) to visualize this dream. Do not include any other text.\nDream: ${transcript}`,
          },
        ],
      },
    ],
    'You are a creative image prompt generator. Output ONLY the prompt, nothing else.',
    { thinkingLevel: 'minimal', maxOutputTokens: 256 }
  );

  return generatedPrompt.trim();
}

export async function generateAndStoreImage(
  options: StoredImageOptions
): Promise<{ imageUrl: string; imageBytes: string; prompt: string; storedImageUrl: string | null }> {
  const { imageBase64, mimeType, raw: imgJson } = await generateImageFromPrompt({
    prompt: options.prompt,
    apiKey: options.apiKey,
    model: options.model,
    aspectRatio: '9:16',
    imageSize: options.imageSize ?? '1K',
  });

  if (!imageBase64) {
    throw Object.assign(new Error('No image returned'), {
      status: 400,
      raw: imgJson,
    });
  }

  const highResolution = options.imageSize === '2K' || options.imageSize === '4K';
  const original = { base64: imageBase64, contentType: mimeType ?? 'image/png' };
  const optimized = await prepareIllustrationForStorage(original, options.imageSize);

  const { uploadImageToStorage, deleteImageFromStorage } = createStorageHelpers({
    supabaseUrl: options.supabaseUrl,
    supabaseServiceRoleKey: options.supabaseServiceRoleKey,
    storageBucket: options.storageBucket,
    ownerId: options.ownerId,
  });

  const storedImageUrl = await uploadImageToStorage(optimized.base64, optimized.contentType);
  if (highResolution && !storedImageUrl) {
    throw new Error('High-resolution image storage failed');
  }
  const imageUrl = storedImageUrl ?? `data:${optimized.contentType};base64,${optimized.base64}`;

  if (options.previousImageUrl) {
    await deleteImageFromStorage(options.previousImageUrl, options.ownerId);
  }

  return {
    imageUrl,
    imageBytes: optimized.base64,
    prompt: options.prompt,
    storedImageUrl,
  };
}
