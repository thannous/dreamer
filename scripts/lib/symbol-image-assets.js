'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./docs-site-config');

const REGISTRY_PATH = path.join(
  ROOT_DIR,
  'docs-src',
  'config',
  'symbol-image-assets.json'
);

function loadSymbolImageRegistry(registryPath = REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) {
    return {
      version: null,
      responsiveBase: '/img/seo/symbols-v1',
      assets: {},
    };
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  return {
    ...registry,
    assets: registry.assets || {},
  };
}

function getGeneratedSymbolImage(symbolId, registry = loadSymbolImageRegistry()) {
  return registry.assets?.[symbolId] || null;
}

function generatedSymbolImagePath(asset) {
  return asset?.src
    ? path.join(ROOT_DIR, 'docs-src', 'static', asset.src.replace(/^\/+/, ''))
    : null;
}

module.exports = {
  REGISTRY_PATH,
  generatedSymbolImagePath,
  getGeneratedSymbolImage,
  loadSymbolImageRegistry,
};
