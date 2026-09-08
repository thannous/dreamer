import type { WebpOptions } from './journalMediaUploadService';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import type { Action as ImageManipulatorAction } from 'expo-image-manipulator';
import { Image, Platform } from 'react-native';

export const readImageFileBase64 = (uri: string): Promise<string> => new FileSystem.File(uri).base64();

const writeBase64TempFile = async (base64: string, extension: string = 'png'): Promise<string> => {
  if (!base64) throw new Error('Missing base64 payload');
  const dir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory ?? '/tmp/';
  const uri = `${dir}dream-upload.${extension}`;
  // Use legacy API to avoid deprecation errors on Hermes while remaining compatible.
  await FileSystemLegacy.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  return uri;
};

const getImageDimensions = async (uri: string): Promise<{ width: number; height: number } | null> => {
  if (typeof Image?.getSize !== 'function') {
    return null;
  }

  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
};

type ImageManipulatorModule = typeof import('expo-image-manipulator');

let imageManipulatorModule: ImageManipulatorModule | null = null;

const shouldUseJestRequire = (): boolean =>
  typeof process !== 'undefined' && typeof process.env?.JEST_WORKER_ID === 'string';

const getImageManipulator = async (): Promise<ImageManipulatorModule | null> => {
  if (imageManipulatorModule !== null) {
    return imageManipulatorModule;
  }
  try {
    const mod = shouldUseJestRequire()
      // Jest must resolve its synchronous mock; native runtime keeps the lazy import.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? (require('expo-image-manipulator') as ImageManipulatorModule)
      : await import('expo-image-manipulator');
    imageManipulatorModule = mod;
    return mod;
  } catch (err) {
    if (__DEV__) {
      console.warn('expo-image-manipulator unavailable; skipping client-side image optimization', err);
    }
    imageManipulatorModule = null;
    return null;
  }
};

export const convertToWebpBase64 = async (
  params: { base64?: string; uri?: string; contentType?: string },
  options: WebpOptions = {}
): Promise<{ base64: string; contentType: string }> => {
  const { base64, uri, contentType } = params;
  const { compress = 0.65, maxDimension, squareSize } = options;
  let sourceUri = uri;
  let cleanupUri: string | null = null;

  if (__DEV__) {
    console.log('[supabaseDreamService] convertToWebpBase64 start', {
      hasBase64: Boolean(base64),
      hasUri: Boolean(uri),
      contentType,
    });
  }

  if (!sourceUri && base64) {
    if (Platform.OS === 'web') {
      const ct = contentType ?? 'image/png';
      sourceUri = `data:${ct};base64,${base64}`;
    } else {
      const ext = contentType?.split('/')[1] ?? 'png';
      sourceUri = await writeBase64TempFile(base64, ext);
      cleanupUri = sourceUri;
    }
  }

  if (!sourceUri) {
    return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
  }

  try {
    const manipulator = await getImageManipulator();
    if (!manipulator) {
      return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
    }

    const actions: ImageManipulatorAction[] = [];
    if (squareSize) {
      actions.push({ resize: { width: squareSize, height: squareSize } });
    } else if (maxDimension) {
      // Heuristic: only resize when payload is likely large to avoid upscaling tiny images.
      const shouldResize = !base64 || base64.length > 400_000;
      if (shouldResize) {
        const dimensions = await getImageDimensions(sourceUri);
        const longestSide = dimensions ? Math.max(dimensions.width, dimensions.height) : null;
        if (dimensions && longestSide && longestSide > maxDimension) {
          if (dimensions.width >= dimensions.height) {
            actions.push({ resize: { width: maxDimension } });
          } else {
            actions.push({ resize: { height: maxDimension } });
          }
        }
      }
    }

    const result = await manipulator.manipulateAsync(
      sourceUri,
      actions,
      {
        compress,
        format: manipulator.SaveFormat.WEBP,
        base64: true,
      }
    );

    const webp = result.base64 ?? base64 ?? '';
    if (__DEV__) {
      console.log('[supabaseDreamService] convertToWebpBase64 success', {
        width: result.width,
        height: result.height,
        base64Length: webp.length,
      });
    }
    return { base64: webp, contentType: 'image/webp' };
  } catch (err) {
    console.warn('convertToWebpBase64 failed, returning original payload', err);
    return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
  } finally {
    if (cleanupUri) {
      FileSystemLegacy.deleteAsync(cleanupUri, { idempotent: true }).catch(() => {});
    }
  }
};
