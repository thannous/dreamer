'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const appConfig = require('../app.json');
const { convertSplashLogos } = require('../plugins/withWebpSplashLogo');

describe('Android splash logo as WebP', () => {
  it('is registered for the app build', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withWebpSplashLogo');
  });

  // aapt fails the build when one folder holds splashscreen_logo.png and .webp.
  it('replaces each density PNG with a WebP and leaves other drawables alone', async () => {
    const resDir = fs.mkdtempSync(path.join(os.tmpdir(), 'splash-res-'));
    try {
      const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#21162b80' } }).png().toBuffer();
      for (const folder of ['drawable-mdpi', 'drawable-xxhdpi']) {
        fs.mkdirSync(path.join(resDir, folder));
        fs.writeFileSync(path.join(resDir, folder, 'splashscreen_logo.png'), png);
      }
      fs.writeFileSync(path.join(resDir, 'drawable-mdpi', 'other.png'), png);

      await convertSplashLogos(resDir);

      expect(fs.readdirSync(path.join(resDir, 'drawable-mdpi')).sort()).toEqual(['other.png', 'splashscreen_logo.webp']);
      expect(fs.readdirSync(path.join(resDir, 'drawable-xxhdpi'))).toEqual(['splashscreen_logo.webp']);
      const meta = await sharp(path.join(resDir, 'drawable-xxhdpi', 'splashscreen_logo.webp')).metadata();
      expect(meta).toMatchObject({ format: 'webp', hasAlpha: true });
    } finally {
      fs.rmSync(resDir, { recursive: true, force: true });
    }
  });
});
