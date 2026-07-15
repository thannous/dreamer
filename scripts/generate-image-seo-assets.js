#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { generateEducationalDiagramSources } = require('./lib/educational-diagram-v2');
const {
  buildVariantUrl,
  getResponsiveImageData,
  readImageAssetRegistry,
  resolveRepoPath,
} = require('./lib/image-seo-assets');

const MAX_1200_BYTES = 250 * 1024;
const WARN_1200_BYTES = 180 * 1024;

function outputPathForUrl(url) {
  if (!url.startsWith('/img/')) throw new Error(`Refusing non-image output URL: ${url}`);
  return resolveRepoPath(path.join('docs-src', 'static', url.slice(1)));
}

function variantHeight(aspect, width) {
  return Math.round((width * aspect.height) / aspect.width);
}

function coverExtractForPosition(metadata, aspect) {
  const sourceWidth = metadata.width;
  const sourceHeight = metadata.height;
  const targetRatio = aspect.width / aspect.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const position = aspect.position || { x: 50, y: 50 };

  if (sourceRatio > targetRatio) {
    const width = Math.max(1, Math.round(sourceHeight * targetRatio));
    return {
      left: Math.round((sourceWidth - width) * (position.x / 100)),
      top: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = Math.max(1, Math.round(sourceWidth / targetRatio));
  return {
    left: 0,
    top: Math.round((sourceHeight - height) * (position.y / 100)),
    width: sourceWidth,
    height,
  };
}

async function sourcePipeline(asset, aspect, width) {
  const sourcePath = resolveRepoPath(aspect.source || asset.source);
  const height = variantHeight(aspect, width);
  const metadata = await sharp(sourcePath).metadata();

  if (asset.role === 'editorial' && aspect.mode === 'ambient') {
    const background = await sharp(sourcePath)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .blur(Math.max(10, Math.round(width / 35)))
      .modulate({ brightness: 0.52, saturation: 0.82 })
      .toBuffer();
    const foreground = await sharp(sourcePath)
      .rotate()
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp({ create: { width, height, channels: 3, background: '#130d2d' } })
      .composite([{ input: background }, { input: foreground, gravity: 'center' }]);
  }

  const fit = aspect.mode === 'cover' ? 'cover' : 'contain';
  const background = asset.role === 'fallback' ? '#140d31' : '#130d2d';
  const density = metadata.format === 'svg' ? 144 : undefined;
  const pipeline = sharp(sourcePath, density ? { density } : undefined).rotate();
  if (fit === 'cover' && aspect.position && metadata.width && metadata.height) {
    return pipeline
      .extract(coverExtractForPosition(metadata, aspect))
      .resize(width, height, { fit: 'fill' });
  }
  return pipeline.resize(width, height, {
    fit,
    position: 'attention',
    background,
  });
}

function encode(pipeline, format) {
  if (format === 'avif') {
    return pipeline.avif({ quality: 52, effort: 5, chromaSubsampling: '4:4:4' });
  }
  if (format === 'webp') {
    return pipeline.webp({ quality: 82, effort: 5, smartSubsample: true });
  }
  if (format === 'jpg') {
    return pipeline.jpeg({ quality: 88, progressive: true, mozjpeg: true });
  }
  throw new Error(`Unsupported output format: ${format}`);
}

function expectedVariants(registry) {
  const variants = [];
  for (const [assetId, asset] of Object.entries(registry.assets)) {
    const formats = asset.formats || registry.variants.formats;
    for (const [aspectName, aspect] of Object.entries(asset.aspects)) {
      for (const width of aspect.widths) {
        for (const format of formats) {
          const url = buildVariantUrl(asset, aspectName, width, format);
          variants.push({
            assetId,
            asset,
            aspectName,
            aspect,
            width,
            height: variantHeight(aspect, width),
            format,
            url,
            outputPath: outputPathForUrl(url),
          });
        }
      }
    }
  }
  return variants;
}

async function validateSources(registry) {
  const errors = [];
  for (const [assetId, asset] of Object.entries(registry.assets)) {
    for (const [aspectName, aspect] of Object.entries(asset.aspects)) {
      const source = aspect.source || asset.source;
      const sourcePath = resolveRepoPath(source);
      if (!fs.existsSync(sourcePath)) {
        errors.push(`${assetId}/${aspectName}: missing source ${source}`);
        continue;
      }
      const metadata = await sharp(sourcePath).metadata();
      if (!metadata.width || !metadata.height) {
        errors.push(`${assetId}/${aspectName}: source has no readable dimensions`);
      }
      if (asset.role === 'editorial' && (metadata.width < 1200 || metadata.height < 675)) {
        errors.push(`${assetId}/${aspectName}: editorial source must be at least 1200x675`);
      }
      if (
        (asset.role === 'educational' || asset.role === 'fallback') &&
        (metadata.width !== aspect.width || metadata.height !== aspect.height)
      ) {
        errors.push(
          `${assetId}/${aspectName}: source must be exactly ${aspect.width}x${aspect.height}`
        );
      }
    }
  }
  if (errors.length) throw new Error(`Invalid image sources:\n- ${errors.join('\n- ')}`);
}

async function generateAssets(registry) {
  const variants = expectedVariants(registry);
  for (const variant of variants) {
    fs.mkdirSync(path.dirname(variant.outputPath), { recursive: true });
    const pipeline = await sourcePipeline(variant.asset, variant.aspect, variant.width);
    await encode(pipeline, variant.format).toFile(variant.outputPath);
  }
  return variants;
}

async function validateOutputs(registry) {
  const variants = expectedVariants(registry);
  const errors = [];
  const warnings = [];
  let totalBytes = 0;
  for (const variant of variants) {
    if (!fs.existsSync(variant.outputPath)) {
      errors.push(`${variant.assetId}: missing ${variant.url}`);
      continue;
    }
    const stats = fs.statSync(variant.outputPath);
    const metadata = await sharp(variant.outputPath).metadata();
    totalBytes += stats.size;
    if (metadata.width !== variant.width || metadata.height !== variant.height) {
      errors.push(
        `${variant.url}: expected ${variant.width}x${variant.height}, got ${metadata.width}x${metadata.height}`
      );
    }
    const expectedFormat = variant.format === 'jpg' ? 'jpeg' : variant.format === 'avif' ? 'heif' : variant.format;
    if (metadata.format !== expectedFormat) {
      errors.push(`${variant.url}: expected ${expectedFormat}, got ${metadata.format}`);
    }
    if (variant.width === 1200 && stats.size > MAX_1200_BYTES) {
      errors.push(`${variant.url}: ${Math.round(stats.size / 1024)} KiB exceeds 250 KiB`);
    } else if (variant.width === 1200 && stats.size > WARN_1200_BYTES) {
      warnings.push(`${variant.url}: ${Math.round(stats.size / 1024)} KiB exceeds 180 KiB`);
    }
  }
  if (errors.length) throw new Error(`Invalid generated image assets:\n- ${errors.join('\n- ')}`);
  return { variants, warnings, totalBytes };
}

function validatePageImageResolution(registry) {
  for (const [canonicalPath, page] of Object.entries(registry.pages)) {
    for (const imageRef of Object.values(page.images)) {
      const aspects = [imageRef.aspect, imageRef.mobileAspect].filter(Boolean);
      for (const aspect of new Set(aspects)) {
        const image = getResponsiveImageData(registry, imageRef.assetId, aspect);
        if (!image.src.startsWith('/img/seo/')) {
          throw new Error(`${canonicalPath}: pilot image URL is not versioned under /img/seo/`);
        }
      }
    }
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  generateEducationalDiagramSources({ checkOnly });
  const registry = readImageAssetRegistry();
  await validateSources(registry);
  validatePageImageResolution(registry);
  if (!checkOnly) await generateAssets(registry);
  const report = await validateOutputs(registry);
  const roleCounts = Object.values(registry.assets).reduce((counts, asset) => {
    counts[asset.role] = (counts[asset.role] || 0) + 1;
    return counts;
  }, {});
  console.log(
    `Image SEO assets ${checkOnly ? 'checked' : 'generated'}: ` +
      `${Object.keys(registry.pages).length} pages, ` +
      `${roleCounts.editorial} editorial masters, ` +
      `${roleCounts.educational} localized diagrams, ` +
      `${roleCounts.fallback} fallback, ` +
      `${report.variants.length} variants, ` +
      `${(report.totalBytes / 1024 / 1024).toFixed(2)} MiB total.`
  );
  for (const warning of report.warnings) console.warn(`WARN ${warning}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  expectedVariants,
  generateAssets,
  outputPathForUrl,
  validateOutputs,
  validateSources,
};
