'use strict';

// Metro passes a file path for ordinary assets and a Buffer for zip assets.
// Keep its synchronous API while parsing only with the patched upstream package.
const { readFileSync } = require('node:fs');
const patched = require('image-size-patched');

function imageSize(input) {
  return patched.imageSize(typeof input === 'string' ? readFileSync(input) : input);
}

module.exports = Object.assign(imageSize, patched, { imageSize, default: imageSize });
