const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

// expo-splash-screen writes the splash logo as a truecolour PNG in each density
// folder (324 KB at xxhdpi). Android decodes WebP drawables natively, and a lossy
// WebP of the same image is a fraction of that. This runs after the splash
// plugin has generated its PNGs and swaps each one for a WebP.
const LOGO_PNG = 'splashscreen_logo.png';
const WEBP_OPTIONS = { quality: 88, alphaQuality: 100, effort: 6 };

function findSplashLogos(resDir) {
  if (!fs.existsSync(resDir)) return [];
  return fs
    .readdirSync(resDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('drawable'))
    .map((entry) => path.join(resDir, entry.name, LOGO_PNG))
    .filter((file) => fs.existsSync(file));
}

async function convertSplashLogos(resDir, sharp = require('sharp')) {
  const converted = [];
  for (const pngPath of findSplashLogos(resDir)) {
    const webpPath = pngPath.replace(/\.png$/, '.webp');
    await sharp(pngPath).webp(WEBP_OPTIONS).toFile(webpPath);
    // Android rejects two resources with the same name in one folder.
    fs.rmSync(pngPath);
    converted.push(webpPath);
  }
  return converted;
}

module.exports = function withWebpSplashLogo(config) {
  return withFinalizedMod(config, [
    'android',
    async (modConfig) => {
      const resDir = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      await convertSplashLogos(resDir);
      return modConfig;
    },
  ]);
};

module.exports.convertSplashLogos = convertSplashLogos;
