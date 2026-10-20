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
  /** A flow's passes on show at once, each a share of a cycle behind the previous one. */
  copies?: number;
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

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isNumbers = (value: unknown, length: number) =>
  Array.isArray(value) && value.length === length && value.every(isNumber);

// Names the app joins to the site's address: one plain segment each, never a path.
const isName = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w.-]+$/.test(value) && !value.includes('..');

// The folder of the paintings on the site, an absolute path of plain segments.
const isBase = (value: unknown): value is string =>
  typeof value === 'string' && /^(\/[\w-]+)+$/.test(value);

const MOTIONS: readonly unknown[] = ['drift', 'flow', 'pulse'];
const BLENDS: readonly unknown[] = [undefined, 'screen', 'multiply'];

const isLayer = (value: unknown): value is AtlasLayer =>
  isRecord(value) &&
  isName(value.file) &&
  isNumbers(value.box, 4) &&
  MOTIONS.includes(value.motion) &&
  (value.move === undefined || isNumbers(value.move, 2)) &&
  isNumber(value.dur) &&
  value.dur > 0 &&
  isNumbers(value.op, 2) &&
  (value.copies === undefined || (Number.isInteger(value.copies) && (value.copies as number) >= 1)) &&
  BLENDS.includes(value.blend);

const isPicture = (value: unknown): value is AtlasPicture =>
  isRecord(value) &&
  isNumber(value.width) &&
  value.width > 0 &&
  isNumber(value.height) &&
  value.height > 0 &&
  isRecord(value.files) &&
  Object.keys(value.files).length > 0 &&
  Object.entries(value.files).every(([width, file]) => Number(width) > 0 && isName(file));

const isScene = (value: unknown): value is AtlasScene =>
  isRecord(value) &&
  isName(value.id) &&
  isPicture(value.image) &&
  Array.isArray(value.layers) &&
  value.layers.every(isLayer) &&
  isRecord(value.variation) &&
  Object.values(value.variation).every((context) => typeof context === 'string');

const isEntry = (value: unknown): value is SymbolAtlasEntry =>
  isRecord(value) &&
  isPicture(value.portrait) &&
  typeof (value.portrait as { position?: unknown }).position === 'string' &&
  Array.isArray(value.layers) &&
  value.layers.every(isLayer) &&
  Array.isArray(value.scenes) &&
  value.scenes.every(isScene);

/**
 * The published file, checked down to each texture before any screen draws from it: it
 * comes from the site, so a damaged one is refused whole (the app keeps the copy it had,
 * or none, and every symbol stays classic) instead of breaking the sheet on every phone.
 */
export function isSymbolAtlas(value: unknown): value is SymbolAtlas {
  if (!isRecord(value) || value.version !== 1 || !isBase(value.base) || !isRecord(value.symbols)) return false;
  return Object.entries(value.symbols).every(([id, entry]) => isName(id) && isEntry(entry));
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
