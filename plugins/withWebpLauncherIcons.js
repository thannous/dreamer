const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

// Expo writes the launcher icons as PNG data inside .webp files (265 KB for the
// xxxhdpi foreground alone), and every APK carries all five densities. This runs
// after the icon generation and:
// - re-encodes the adaptive icon layers as real lossless WebP, so they look the same;
// - deletes the legacy ic_launcher and ic_launcher_round bitmaps. Android 8 and later
//   draw the adaptive icon from mipmap-anydpi-v26, so with minSdk 26 or more no device
//   ever selects them.
const ADAPTIVE_LAYERS = ['ic_launcher_foreground.webp', 'ic_launcher_background.webp', 'ic_launcher_monochrome.webp'];
const LEGACY_ICONS = ['ic_launcher.webp', 'ic_launcher_round.webp'];
const ADAPTIVE_ICON_MIN_SDK = 26;

function readMinSdk(projectRoot) {
  const properties = path.join(projectRoot, 'gradle.properties');
  const match = fs.existsSync(properties)
    && fs.readFileSync(properties, 'utf8').match(/^android\.minSdkVersion=(\d+)$/m);
  return match ? Number(match[1]) : undefined;
}

function isRealWebp(buffer) {
  return buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
}

async function convertLauncherIcons(resDir, minSdk, sharp = require('sharp')) {
  if (!(minSdk >= ADAPTIVE_ICON_MIN_SDK)) {
    throw new Error(`withWebpLauncherIcons removes the legacy launcher bitmaps and needs minSdk ${ADAPTIVE_ICON_MIN_SDK} or more (found ${minSdk ?? 'none'}).`);
  }
  if (!fs.existsSync(path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'))) {
    throw new Error('withWebpLauncherIcons found no adaptive launcher icon in mipmap-anydpi-v26.');
  }
  const changed = [];
  const densities = fs
    .readdirSync(resDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^mipmap-[a-z]+dpi$/.test(entry.name))
    .map((entry) => path.join(resDir, entry.name));
  for (const dir of densities) {
    for (const name of LEGACY_ICONS) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        fs.rmSync(file);
        changed.push(file);
      }
    }
    for (const name of ADAPTIVE_LAYERS) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      const input = fs.readFileSync(file);
      if (isRealWebp(input)) continue;
      fs.writeFileSync(file, await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer());
      changed.push(file);
    }
  }
  return changed;
}

module.exports = function withWebpLauncherIcons(config) {
  return withFinalizedMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.platformProjectRoot;
      const resDir = path.join(projectRoot, 'app', 'src', 'main', 'res');
      await convertLauncherIcons(resDir, readMinSdk(projectRoot));
      return modConfig;
    },
  ]);
};

module.exports.convertLauncherIcons = convertLauncherIcons;
module.exports.readMinSdk = readMinSdk;
