'use strict';

// The geometry of the atlas's living paintings, shared by the site's symbol pages
// (docs-src/static/scripts/generate-symbol-pages.js) and the app's copy of the atlas
// (scripts/sync-app-symbol-dictionary.js), so a texture covers the same part of a
// painting on both.

// Where the paintings and textures are published: <ATLAS_SIX_IMAGES>/<id>/<role>-<width>-<hash>.<format>.
const ATLAS_SIX_IMAGES = '/img/symbols/atlas-six-v2';

// A 16:9 texture keeps its ratio over a painting of another ratio: it fits the painting's
// width ('width') or covers it ('cover'), optionally zoomed on the part that carries the
// effect, anchored by x and y (0 = left or top edge, 1 = right or bottom edge). The stage
// clips what overflows; the side illustration also masks it with its own alpha.
function atlasSixBox({ fit, zoom = 1, x = 0.5, y = 0.5 }, painting, texture) {
  const ratio = (painting.width / painting.height) / (texture.width / texture.height);
  let w = 1;
  let h = ratio;
  if (fit === 'cover' && h < 1) {
    w = 1 / h;
    h = 1;
  }
  w *= zoom;
  h *= zoom;
  const round = (value) => Number(value.toFixed(4));
  return [round(x * (1 - w)), round(y * (1 - h)), round(w), round(h)];
}

// The texture closest to `max` pixels wide without exceeding it (the smallest otherwise).
function atlasSixLayerSrc(layer, max) {
  const widths = Object.keys(layer.webp).map(Number).sort((a, b) => a - b);
  const width = widths.filter((w) => w <= max).pop() || widths[0];
  return layer.webp[width];
}

module.exports = { ATLAS_SIX_IMAGES, atlasSixBox, atlasSixLayerSrc };
