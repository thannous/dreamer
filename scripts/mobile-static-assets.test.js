const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.join(__dirname, '..');
const IMAGE_DIR = path.join(ROOT_DIR, 'assets', 'images');

const ASSET_BASELINES = {
  splash: 4_378_731,
  intro: 714_570,
  path: 596_710,
};

describe('mobile static asset contract', () => {
  it('keeps the splash source compact, square, and transparent', async () => {
    const assetPath = path.join(IMAGE_DIR, 'splash-logo.png');
    const metadata = await sharp(assetPath).metadata();

    expect(metadata).toMatchObject({
      format: 'png',
      width: 1024,
      height: 1024,
      hasAlpha: true,
      isPalette: false,
    });
    expect(fs.statSync(assetPath).size).toBeLessThan(ASSET_BASELINES.splash * 0.25);
  });

  it.each([
    ['onboarding-astral-background.webp', 731, 650, ASSET_BASELINES.intro],
    ['onboarding-path-background.webp', 853, 510, ASSET_BASELINES.path],
  ])('keeps %s as an opaque, size-efficient WebP at its source ratio', async (
    filename,
    width,
    height,
    baselineBytes
  ) => {
    const assetPath = path.join(IMAGE_DIR, filename);
    const image = sharp(assetPath);

    await expect(image.metadata()).resolves.toMatchObject({
      format: 'webp',
      width,
      height,
      hasAlpha: false,
    });
    await expect(image.stats()).resolves.toMatchObject({ isOpaque: true });
    expect(fs.statSync(assetPath).size).toBeLessThan(baselineBytes * 0.15);
  });

  it('references the WebP backgrounds from onboarding and keeps Metro support enabled', () => {
    const source = fs.readFileSync(path.join(ROOT_DIR, 'app', 'onboarding.tsx'), 'utf8');
    const metroConfig = require('../metro.config');

    expect(source).toContain(
      "require('@/assets/images/onboarding-astral-background.webp')"
    );
    expect(source).toContain(
      "require('@/assets/images/onboarding-path-background.webp')"
    );
    expect(source).not.toMatch(/onboarding-(?:astral|path)-background\.png/);
    expect(metroConfig.resolver.assetExts).toContain('webp');
  });
});
