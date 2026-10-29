import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The app shows some paintings from the site's CDN (lib/remoteArt.ts). Journeys block every
// external request, so they answer those URLs with the committed exports the manifest names,
// exactly as media.noctalia.app would once they are published: same bytes, type and CORS.
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'assets/remote/app-media.json'), 'utf8')) as Record<string, [string, number, string]>;
const files = new Map(Object.values(manifest).map(([source, , sha256]) => [`/app/v1/${sha256}${path.extname(source)}`, path.join(root, source)]));

export const APP_MEDIA_ORIGIN = 'https://media.noctalia.app';

/** The response for an app media URL, or null for any other request. */
export function appMediaResponse(url: URL) {
  const file = url.origin === APP_MEDIA_ORIGIN ? files.get(url.pathname) : undefined;
  return file ? { path: file, contentType: 'image/webp', headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000, immutable' } } : null;
}
