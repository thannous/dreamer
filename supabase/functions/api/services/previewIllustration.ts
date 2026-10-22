import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { generateImageFromPrompt, resolveImageModel } from './geminiImages.ts';
import { prepareIllustrationForStorage } from './imagePipeline.ts';
import { PREVIEW_OBJECT_PREFIX, PREVIEW_PAINTING_TIMEOUT_MS } from '../lib/analysisPreview.ts';

/** The share of the painting's height the band shows, around its middle. */
const BAND_SHARE = 1 / 3;
const BAND_QUALITY = 80;
/** As long as a dream's own illustration link (services/storage.ts). */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;
/**
 * The band's link lasts an hour and is signed again at each read: a dream deleted (its band
 * then left out of every read) or opened stops showing it soon after.
 */
export const BAND_LINK_SECONDS = 60 * 60;
/** How long an image job waits for a prepared painting under way rather than paying for another. */
const PAINTING_WAIT_MS = 60 * 1000;
const PAINTING_POLL_MS = 3000;

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
    const { data, error } = await objects.createSignedUrl(bandPath, BAND_LINK_SECONDS);
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

/** A prepared painting taken by a job, held for it until the dream stores its link. */
export type TakenPainting = {
  path: string;
  url: string;
  /** Once the dream holds it: its band goes and the preview keeps no path to it. */
  settle: () => Promise<void>;
  /** Not stored after all: ready again for the next job, from where it now lies. */
  giveBack: () => Promise<void>;
};

/**
 * The painting prepared for this dream from this very image prompt (or, for a job asked with
 * the dream's text only, from this very text), moved to the account's own prefix and linked
 * like any dream illustration; null when there is none to take. A painting still under way is
 * waited for: the analysis was opened before it was done. The taker settles it once the dream
 * holds its link, or gives it back, so a job that fails after the take leaves it for the next.
 */
export async function takePreparedIllustration(admin: AdminClient, input: {
  bucket: string;
  userId: string;
  dreamId: number;
  prompt?: string;
  transcriptSha256?: string;
  /** How long a painting under way is waited for; 0 takes only a finished one. */
  waitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<TakenPainting | null> {
  try {
    const previews = () => admin.from('analysis_previews');
    const now = input.now ?? Date.now;
    const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const read = async () => {
      const { data, error } = await previews()
        .select('image_status, image_prompt, image_path, band_path, transcript_sha256, image_updated_at')
        .eq('user_id', input.userId).eq('dream_id', input.dreamId).maybeSingle();
      if (error || !data) return null;
      const same = input.prompt
        ? data.image_prompt === input.prompt
        : Boolean(input.transcriptSha256) && data.transcript_sha256 === input.transcriptSha256;
      return same ? data : null;
    };
    let row = await read();
    const waitUntil = now() + (input.waitMs ?? PAINTING_WAIT_MS);
    while (row?.image_status === 'painting' && now() < waitUntil
      && Date.parse(row.image_updated_at ?? '') > now() - PREVIEW_PAINTING_TIMEOUT_MS) {
      await sleep(PAINTING_POLL_MS);
      row = await read();
    }
    if (row?.image_status !== 'ready' || typeof row.image_path !== 'string') return null;
    const { data: taken, error: takeError } = await previews()
      .update({ image_status: 'used', image_updated_at: new Date().toISOString() })
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('image_status', 'ready').eq('image_path', row.image_path)
      .select('dream_id');
    if (takeError || !taken?.length) return null;

    const objects = admin.storage.from(input.bucket);
    const ownPath = `${input.userId}/${row.image_path.split('/').pop()}`;
    // The row holds the painting where it lies (its band kept) until the dream holds its link.
    const held = (path: string, values: Record<string, unknown>) => previews().update(values)
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('image_status', 'used').eq('image_path', path)
      .then(() => undefined, () => undefined);
    const giveBack = (path: string) => held(path, { image_status: 'ready' });
    // A painting already moved once (its link could not be made then) only needs its link.
    const moved = row.image_path === ownPath ? { error: null } : await objects.move(row.image_path, ownPath);
    if (moved.error) {
      // Still where it was: the painting stays ready for the next job instead of being paid again.
      console.warn('[analysis-preview] could not move a prepared painting');
      await giveBack(row.image_path);
      return null;
    }
    if (ownPath !== row.image_path) {
      await previews().update({ image_path: ownPath })
        .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('image_status', 'used').eq('image_path', row.image_path);
    }
    const { data: signed, error: signError } = await objects.createSignedUrl(ownPath, SIGNED_URL_SECONDS);
    if (signError || !signed?.signedUrl) {
      await giveBack(ownPath);
      return null;
    }
    const bandPath = row.band_path;
    return {
      path: ownPath,
      url: signed.signedUrl,
      settle: async () => {
        await removePreviewObjects(admin, input.bucket, [bandPath]);
        await held(ownPath, { image_path: null, band_path: null, band_url: null });
      },
      giveBack: () => giveBack(ownPath),
    };
  } catch {
    console.warn('[analysis-preview] could not take a prepared painting');
    return null;
  }
}

/** The prepared painting a job attached to its dream. */
export type AttachedPainting = {
  /** The analysis was not saved after all: the dream drops the painting, if it still holds it. */
  detach: () => Promise<void>;
};

/**
 * Once the analysis has taken the prepared reading and asked for no illustration, the painting
 * prepared with it (already paid for) becomes the dream's illustration, if the dream has none
 * and is still waiting for this very analysis. Nothing is painted here: no painting to take
 * leaves the dream as it is.
 */
export async function attachPreparedIllustration(admin: AdminClient, input: {
  bucket: string;
  userId: string;
  dreamId: number;
  prompt: string;
  /** The analysis request the dream must still be waiting for. */
  analysisRequestId: string;
  waitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<AttachedPainting | null> {
  try {
    const dreams = () => admin.from('dreams');
    const { data: dream, error } = await dreams().select('image_url')
      .eq('id', input.dreamId).eq('user_id', input.userId).maybeSingle();
    if (error || !dream || dream.image_url) return null;
    const painting = await takePreparedIllustration(admin, input);
    if (!painting) return null;
    const { data: set, error: setError } = await dreams()
      .update({ image_url: painting.url, image_generation_failed: false })
      .eq('id', input.dreamId).eq('user_id', input.userId)
      .eq('analysis_request_id', input.analysisRequestId).eq('analysis_status', 'pending')
      .or('image_url.is.null,image_url.eq.')
      .select('id');
    // A lost answer may hide a saved link: the painting then stays where it is, ready again.
    if (setError) {
      await painting.giveBack();
      return null;
    }
    if (!set?.length) {
      // Illustrated or asked again meanwhile: the taken painting would be left unseen.
      await painting.settle();
      await removeObject(admin, input.bucket, painting.path);
      return null;
    }
    await painting.settle();
    return {
      detach: async () => {
        const { data: dropped, error: dropError } = await dreams()
          .update({ image_url: null })
          .eq('id', input.dreamId).eq('user_id', input.userId).eq('image_url', painting.url)
          .select('id');
        if (!dropError && dropped?.length) await removeObject(admin, input.bucket, painting.path);
      },
    };
  } catch {
    console.warn('[analysis-preview] could not attach a prepared painting');
    return null;
  }
}

async function removeObject(admin: AdminClient, bucket: string, path: string) {
  await Promise.resolve(admin.storage.from(bucket).remove([path])).then(() => undefined, () => undefined);
}
