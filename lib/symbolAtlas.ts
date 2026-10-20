import type { ImageContentPosition } from 'expo-image';

import type { SymbolLanguage } from '@/lib/symbolTypes';

/**
 * The atlas: the living paintings and painted scenes of the symbols that have them,
 * written by scripts/sync-app-symbol-dictionary.js from the site's atlas config
 * (docs-src/config/symbol-atlas-*.json). The site serves every file; a texture's box is
 * already placed on its painting by the site's own geometry (scripts/lib/atlas-motion.js).
 */
export type AtlasMotion = 'drift' | 'flow' | 'pulse';

export interface AtlasLayer {
  /** File name in `<base>/<id>/`. */
  file: string;
  /** [x, y, width, height] as fractions of the painting; it may overflow, the painting clips it. */
  box: [number, number, number, number];
  motion: AtlasMotion;
  /** How far the site moves it, in boxes, over one cycle (drift and flow). */
  move?: [number, number];
  /** Seconds of one cycle on the site. */
  dur: number;
  /** Opacity range on the site. */
  op: [number, number];
  blend?: 'screen' | 'multiply';
}

export interface AtlasPicture {
  width: number;
  height: number;
  /** Pixel width -> file name in `<base>/<id>/`. */
  files: Record<string, string>;
}

export interface AtlasScene {
  id: string;
  image: AtlasPicture;
  layers: AtlasLayer[];
  /**
   * Context of the variation card the scene paints, per language, as the content files
   * spell it. A context rather than a rank, so content cached before a site publish that
   * moved its cards never pairs a painting with a neighbouring card.
   */
  variation: Partial<Record<SymbolLanguage, string>>;
}

export interface SymbolAtlasEntry {
  /** Painted for a phone held upright; `position` is its CSS object-position. */
  portrait: AtlasPicture & { position: string };
  layers: AtlasLayer[];
  scenes: AtlasScene[];
}

export interface SymbolAtlas {
  version: 1;
  base: string;
  symbols: Record<string, SymbolAtlasEntry>;
}

const SITE_ORIGIN = 'https://noctalia.app';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isPicture = (value: unknown): value is AtlasPicture =>
  isRecord(value) && typeof value.width === 'number' && typeof value.height === 'number' && isRecord(value.files);

/** A light check of the published file: a format it cannot read leaves every symbol classic. */
export function isSymbolAtlas(value: unknown): value is SymbolAtlas {
  if (!isRecord(value) || value.version !== 1 || typeof value.base !== 'string' || !isRecord(value.symbols)) return false;
  return Object.values(value.symbols).every(
    (entry) => isRecord(entry) && isPicture(entry.portrait) && Array.isArray(entry.layers) && Array.isArray(entry.scenes),
  );
}

export function atlasFileUri(atlas: SymbolAtlas, id: string, file: string): string {
  return `${SITE_ORIGIN}${atlas.base}/${id}/${file}`;
}

/** Every published width of a painting, so expo-image picks the one its frame needs. */
export function atlasPictureSources(atlas: SymbolAtlas, id: string, picture: AtlasPicture) {
  return Object.entries(picture.files)
    .map(([width, file]) => ({
      uri: atlasFileUri(atlas, id, file),
      width: Number(width),
      height: Math.round((Number(width) * picture.height) / picture.width),
    }))
    .sort((a, b) => a.width - b.width);
}

const parsePosition = (position: string): [number, number] => {
  const [x = 50, y = 50] = position.split(' ').map((value) => Number.parseFloat(value));
  return [Number.isFinite(x) ? x / 100 : 0.5, Number.isFinite(y) ? y / 100 : 0.5];
};

/** The painting's position for expo-image's `contentPosition`. */
export function atlasContentPosition(position: string): ImageContentPosition {
  const [x, y] = parsePosition(position);
  return { left: `${x * 100}%`, top: `${y * 100}%` };
}

/**
 * Where a painting really sits in a frame it covers (CSS object-fit: cover at `position`):
 * its textures are placed on that rectangle, which the frame then clips.
 */
export function coverRect(frame: { width: number; height: number }, picture: { width: number; height: number }, position = '50% 50%') {
  const scale = Math.max(frame.width / picture.width, frame.height / picture.height);
  const width = picture.width * scale;
  const height = picture.height * scale;
  const [x, y] = parsePosition(position);
  return { left: (frame.width - width) * x, top: (frame.height - height) * y, width, height };
}
