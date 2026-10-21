'use strict';

// Metro uses the old callable CommonJS export with a Buffer. All parsing stays
// in the patched upstream package; the site also uses the named imageSize export.
const patched = require('image-size-patched');
module.exports = Object.assign(patched.imageSize, patched);
