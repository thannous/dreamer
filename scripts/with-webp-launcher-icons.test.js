'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const appConfig = require('../app.json');
const { convertLauncherIcons, readMinSdk } = require('../plugins/withWebpLauncherIcons');

async function launcherRes() {
  const resDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-res-'));
  // Expo writes PNG bytes under the .webp names.
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#21162b80' } }).png().toBuffer();
  fs.mkdirSync(path.join(resDir, 'mipmap-anydpi-v26'));
  fs.writeFileSync(path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), '<adaptive-icon />');
  for (const folder of ['mipmap-mdpi', 'mipmap-xxxhdpi']) {
    fs.mkdirSync(path.join(resDir, folder));
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background', 'ic_launcher_monochrome']) {
      fs.writeFileSync(path.join(resDir, folder, `${name}.webp`), png);
    }
  }
  return { resDir, png };
}

describe('Android launcher icons as real WebP', () => {
  it('is registered for the app build at a minSdk with adaptive icons', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withWebpLauncherIcons');
    const buildProperties = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
    expect(buildProperties[1].android.minSdkVersion).toBeGreaterThanOrEqual(26);
  });

  it('keeps identical adaptive layers as lossless WebP and drops the legacy bitmaps', async () => {
    const { resDir, png } = await launcherRes();
    try {
      await convertLauncherIcons(resDir, 28);
      for (const folder of ['mipmap-mdpi', 'mipmap-xxxhdpi']) {
        expect(fs.readdirSync(path.join(resDir, folder)).sort()).toEqual([
          'ic_launcher_background.webp', 'ic_launcher_foreground.webp', 'ic_launcher_monochrome.webp',
        ]);
      }
      const layer = path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher_foreground.webp');
      expect(fs.readFileSync(layer).subarray(8, 12).toString('latin1')).toBe('WEBP');
      const [before, after] = await Promise.all([png, layer].map((input) => sharp(input).raw().toBuffer()));
      expect(after.equals(before)).toBe(true);
      expect(fs.existsSync(path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'))).toBe(true);
    } finally {
      fs.rmSync(resDir, { recursive: true, force: true });
    }
  });

  // Below API 26 the legacy bitmaps are the only launcher icon.
  it('refuses to drop the legacy bitmaps for a minSdk without adaptive icons', async () => {
    const { resDir } = await launcherRes();
    try {
      await expect(convertLauncherIcons(resDir, 24)).rejects.toThrow('minSdk 26');
      await expect(convertLauncherIcons(resDir, undefined)).rejects.toThrow('minSdk 26');
      expect(fs.existsSync(path.join(resDir, 'mipmap-mdpi', 'ic_launcher.webp'))).toBe(true);
    } finally {
      fs.rmSync(resDir, { recursive: true, force: true });
    }
  });

  it('reads the minSdk that expo-build-properties writes', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-gradle-'));
    try {
      fs.writeFileSync(path.join(projectRoot, 'gradle.properties'), 'org.gradle.jvmargs=-Xmx2g\nandroid.minSdkVersion=28\n');
      expect(readMinSdk(projectRoot)).toBe(28);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
