export const SHARE_IMAGE_FALLBACK_EXTENSION = 'jpg';

export function getFileExtensionFromUrl(url?: string): string {
  if (!url) return SHARE_IMAGE_FALLBACK_EXTENSION;
  const cleanUrl = url.split('?')[0] ?? '';
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  if (!match) return SHARE_IMAGE_FALLBACK_EXTENSION;
  const ext = match[1].toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ext;
}

export function getMimeTypeFromExtension(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    default:
      return 'image/jpeg';
  }
}

