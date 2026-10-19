// The contract of an atlas asset pack: the eight roles of one symbol page, the sizes the
// site serves, the encoder recipes and the alpha limits. The pack tool validates and encodes
// against it; the site generator (docs-src/static/scripts/generate-symbol-pages.js) reads the
// result from the shared manifest docs-src/config/symbol-atlas-six-assets.json, under the one
// prefix it accepts.

export const PACK_SCHEMA = 'noctalia.atlas-pack/1';
export const RECEIPT_SCHEMA = 'noctalia.atlas-pack-receipt/1';
export const IMAGE_PREFIX = '/img/symbols/atlas-six-v2';
export const SHARED_MANIFEST = 'docs-src/config/symbol-atlas-six-assets.json';
export const PILOTS_CONFIG = 'docs-src/config/symbol-atlas-pilots.json';
export const CATALOG = 'data/dream-symbols.json';
export const ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

// Served widths ('native' = the source width); a width above the source is left out, never upscaled.
// `ratio` is an orientation range (width / height), not a reference size: sources keep their native
// proportions (an existing 1400×768 landscape painting passes) and the generator places the textures
// over any ratio. `minWidth` is the largest fixed served width, so no fixed size is ever upscaled.
// Opaque roles must not carry transparency; alpha roles must carry real alpha.
const HERO = { quality: { avif: { quality: 60, effort: 4 }, webp: { quality: 86, effort: 5 } } };
const ALPHA_OR_DETAIL = { quality: { avif: { quality: 62, effort: 4 }, webp: { quality: 88, alphaQuality: 100, effort: 5 } } };
const LANDSCAPE = [1.5, 2.0];
export const ROLE_RULES = {
  hero: { ...HERO, widths: [400, 800, 1200, 'native'], minWidth: 1200, ratio: LANDSCAPE, alpha: false },
  portrait: { ...HERO, widths: [480, 800, 'native'], minWidth: 800, ratio: [0.5, 0.7], alpha: false },
  plate: { ...ALPHA_OR_DETAIL, widths: [700, 'native'], minWidth: 700, ratio: [1.0, 1.6], alpha: true },
  scene: { ...ALPHA_OR_DETAIL, widths: [320, 640], minWidth: 640, ratio: LANDSCAPE, alpha: false },
  layer: { ...ALPHA_OR_DETAIL, widths: [480, 960], minWidth: 960, ratio: LANDSCAPE, alpha: true },
  accent: { ...ALPHA_OR_DETAIL, widths: [480, 960], minWidth: 960, ratio: LANDSCAPE, alpha: true },
};

// Alpha roles: share of fully transparent pixels within [2 %, 99.9 %] and at least 0.1 % translucent
// pixels (the soft edges of a real cut-out or texture). Opaque roles: at most 0.1 % non-opaque pixels.
export const ALPHA_LIMITS = { minTransparent: 0.02, maxTransparent: 0.999, minTranslucent: 0.001, maxOpaqueRoleNonOpaque: 0.001 };

export const SOURCE_FORMATS = ['png', 'webp', 'tiff', 'avif', 'heif', 'jpeg'];
export const OUTPUT_FORMATS = ['avif', 'webp'];

export function rolesOf(sceneIds) {
  return ['hero', 'portrait', 'plate', ...sceneIds.map((id) => `scene-${id}`), 'layer', 'accent'];
}

export function ruleOf(role) {
  return ROLE_RULES[role.startsWith('scene-') ? 'scene' : role];
}

// Output path of one encoded size, as the generator's manifest check expects it.
export function outputUrl(symbolId, role, width, hash12, format) {
  return `${IMAGE_PREFIX}/${symbolId}/${role}-${width}-${hash12}.${format}`;
}
