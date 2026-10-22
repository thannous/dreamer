import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { generateImageFromPrompt, resolveImageModel } from './geminiImages.ts';
import { prepareIllustrationForStorage } from './imagePipeline.ts';
import { PREVIEW_OBJECT_PREFIX } from '../lib/analysisPreview.ts';

/** The share of the painting's height the band shows, around its middle. */
const BAND_SHARE = 1 / 3;
const BAND_QUALITY = 80;
/** As long as a dream's own illustration link (services/storage.ts). */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;

// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any; storage: { from: (bucket: string) => any } };

/** The middle band of a painting, the only part a free account sees before it opens the analysis. */
export async function cropBand(bytes: Uint8Array): Promise<Uint8Array> {
  const image = await Image.decode(bytes);
  const height = Math.max(1, Math.round(image.height * BAND_SHARE));
  image.crop(0, Math.max(0, Math.round((image.height - height) / 2)), image.width, height);
  return await image.encodeJPEG(BAND_QUALITY);
}

/** Paints a prepared analysis's illustration and stores it, whole and as its band, out of the account's reach. */
export async function paintPreparedIllustration(input: {
  admin: AdminClient;
  bucket: string;
  apiKey: string;
  userId: string;
  dreamId: number;
  prompt: string;
  generate?: typeof generateImageFromPrompt;
}): Promise<{ imagePath: string; bandPath: string; bandUrl: string }> {
  const { imageBase64, mimeType } = await (input.generate ?? generateImageFromPrompt)({
    prompt: input.prompt,
    apiKey: input.apiKey,
    // The illustration a free account's analysis gets, so the image job can take it as it is.
    model: resolveImageModel('free', undefined, '1K'),
    aspectRatio: '9:16',
    imageSize: '1K',
  });
  if (!imageBase64) throw new Error('No image returned');
  const painting = await prepareIllustrationForStorage({ base64: imageBase64, contentType: mimeType ?? 'image/png' }, '1K');
  const paintingBytes = decodeBase64(painting.base64);
  const band = await cropBand(paintingBytes);

  const name = `${PREVIEW_OBJECT_PREFIX}/${input.userId}/${input.dreamId}-${crypto.randomUUID()}`;
  const extension = painting.contentType.split('/')[1] || 'png';
  const imagePath = `${name}.${extension}`;
  const bandPath = `${name}-band.jpg`;
  const objects = input.admin.storage.from(input.bucket);
  const options = { upsert: false, cacheControl: '31536000' };
  const stored = await objects.upload(imagePath, paintingBytes, { ...options, contentType: painting.contentType });
  if (stored.error) throw stored.error;
  try {
    const storedBand = await objects.upload(bandPath, band, { ...options, contentType: 'image/jpeg' });
    if (storedBand.error) throw storedBand.error;
    const { data, error } = await objects.createSignedUrl(bandPath, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw error ?? new Error('No signed link');
    return { imagePath, bandPath, bandUrl: data.signedUrl };
  } catch (error) {
    await removePreviewObjects(input.admin, input.bucket, [imagePath, bandPath]);
    throw error;
  }
}

/** Best effort: an object left behind is only removed with the account. */
export async function removePreviewObjects(admin: AdminClient, bucket: string, paths: (string | null | undefined)[]) {
  const keys = paths.filter((path): path is string => typeof path === 'string' && path.startsWith(`${PREVIEW_OBJECT_PREFIX}/`));
  if (!keys.length) return;
  try {
    const { error } = await admin.storage.from(bucket).remove(keys);
    if (error) console.warn('[analysis-preview] could not remove prepared painting objects');
  } catch {
    console.warn('[analysis-preview] could not remove prepared painting objects');
  }
}

/**
 * The painting prepared for this dream from this very image prompt, moved to the account's
 * own prefix and linked like any dream illustration; null when there is none to take.
 */
export async function takePreparedIllustration(admin: AdminClient, input: {
  bucket: string;
  userId: string;
  dreamId: number;
  prompt: string;
}): Promise<string | null> {
  try {
    const previews = () => admin.from('analysis_previews');
    const { data: row, error } = await previews()
      .select('image_status, image_prompt, image_path, band_path')
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).maybeSingle();
    if (error || row?.image_status !== 'ready' || row.image_prompt !== input.prompt || typeof row.image_path !== 'string') return null;
    const { data: taken, error: takeError } = await previews()
      .update({ image_status: 'used', image_updated_at: new Date().toISOString() })
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('image_status', 'ready').eq('image_path', row.image_path)
      .select('dream_id');
    if (takeError || !taken?.length) return null;

    const objects = admin.storage.from(input.bucket);
    const ownPath = `${input.userId}/${row.image_path.split('/').pop()}`;
    const moved = await objects.move(row.image_path, ownPath);
    if (moved.error) {
      console.warn('[analysis-preview] could not move a prepared painting');
      return null;
    }
    await removePreviewObjects(admin, input.bucket, [row.band_path]);
    await previews()
      .update({ image_path: null, band_path: null, band_url: null })
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('image_status', 'used');
    const { data: signed, error: signError } = await objects.createSignedUrl(ownPath, SIGNED_URL_SECONDS);
    if (signError || !signed?.signedUrl) return null;
    return signed.signedUrl;
  } catch {
    console.warn('[analysis-preview] could not take a prepared painting');
    return null;
  }
}
