const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REGISTRY_PATH = path.join(
  REPO_ROOT,
  'docs-src',
  'config',
  'image-assets.json'
);
const SUPPORTED_FORMATS = new Set(['avif', 'jpg', 'webp']);
const SUPPORTED_ROLES = new Set(['editorial', 'educational', 'fallback']);
const PAGE_IMAGE_ROLES = ['editorial', 'educational'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeCanonicalPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, 'https://noctalia.app');
    return url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  } catch {
    const pathname = raw.startsWith('/') ? raw : `/${raw}`;
    return pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  }
}

function resolveRepoPath(relativePath) {
  const resolved = path.resolve(REPO_ROOT, relativePath);
  const rootWithSeparator = `${REPO_ROOT}${path.sep}`;
  if (resolved !== REPO_ROOT && !resolved.startsWith(rootWithSeparator)) {
    throw new Error(`Image asset path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

function readImageAssetRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  validateImageAssetRegistry(registry);
  return registry;
}

function validateImageAssetRegistry(registry) {
  const errors = [];
  if (registry?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!registry?.release) errors.push('release is required');
  if (!registry?.assets || typeof registry.assets !== 'object') errors.push('assets is required');
  if (!registry?.pages || typeof registry.pages !== 'object') errors.push('pages is required');

  for (const [assetId, asset] of Object.entries(registry?.assets || {})) {
    if (!SUPPORTED_ROLES.has(asset.role)) {
      errors.push(`${assetId}: unsupported role ${asset.role}`);
    }
    if (!asset.source) errors.push(`${assetId}: source is required`);
    if (
      !asset.outputStem?.startsWith('/img/seo/') &&
      !asset.outputPattern?.startsWith('/img/')
    ) {
      errors.push(`${assetId}: outputStem or outputPattern must use a root-relative /img/ path`);
    }
    if (typeof asset.visible !== 'boolean') errors.push(`${assetId}: visible must be boolean`);
    if (typeof asset.sitemap !== 'boolean') errors.push(`${assetId}: sitemap must be boolean`);
    if (!asset.aspects || typeof asset.aspects !== 'object') {
      errors.push(`${assetId}: aspects are required`);
      continue;
    }
    for (const [aspectName, aspect] of Object.entries(asset.aspects)) {
      if (!Number.isInteger(aspect.width) || !Number.isInteger(aspect.height)) {
        errors.push(`${assetId}/${aspectName}: integer width and height are required`);
      }
      if (!Array.isArray(aspect.widths) || aspect.widths.some((width) => !Number.isInteger(width))) {
        errors.push(`${assetId}/${aspectName}: widths must contain integers`);
      }
    }
  }

  for (const [pagePath, page] of Object.entries(registry?.pages || {})) {
    if (normalizeCanonicalPath(pagePath) !== pagePath) {
      errors.push(`${pagePath}: page key must be a normalized canonical path`);
    }
    if (!page.pageId || !page.locale || !page.kind) {
      errors.push(`${pagePath}: pageId, locale and kind are required`);
    }
    for (const role of PAGE_IMAGE_ROLES) {
      const image = page.images?.[role];
      if (!image) {
        errors.push(`${pagePath}: ${role} image is required`);
        continue;
      }
      const asset = registry.assets?.[image.assetId];
      if (!asset) {
        errors.push(`${pagePath}: unknown asset ${image.assetId}`);
      } else if (asset.role !== role) {
        errors.push(`${pagePath}: ${image.assetId} is not ${role}`);
      } else if (!asset.aspects?.[image.aspect]) {
        errors.push(`${pagePath}: ${image.assetId} has no ${image.aspect} aspect`);
      }
      if (!image.alt?.trim()) errors.push(`${pagePath}: ${role} alt is required`);
      if (!image.caption?.trim()) errors.push(`${pagePath}: ${role} caption is required`);
    }
    if (!page.insertBefore?.trim()) errors.push(`${pagePath}: insertBefore is required`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid image SEO registry:\n- ${errors.join('\n- ')}`);
  }
  return registry;
}

function getPageImageSet(registry, canonicalPathOrOptions, lang) {
  if (
    typeof canonicalPathOrOptions === 'string' &&
    (canonicalPathOrOptions.startsWith('/') || /^https?:\/\//i.test(canonicalPathOrOptions))
  ) {
    return registry.pages[normalizeCanonicalPath(canonicalPathOrOptions)] || null;
  }

  if (typeof canonicalPathOrOptions === 'string') {
    return (
      Object.values(registry.pages).find(
        (page) => page.pageId === canonicalPathOrOptions && (!lang || page.locale === lang)
      ) || null
    );
  }

  const options = canonicalPathOrOptions || {};
  if (options.canonicalPath) {
    return registry.pages[normalizeCanonicalPath(options.canonicalPath)] || null;
  }
  return (
    Object.values(registry.pages).find(
      (page) => page.pageId === options.pageId && (!options.lang || page.locale === options.lang)
    ) || null
  );
}

function buildVariantUrl(asset, aspectName, width, format) {
  if (!SUPPORTED_FORMATS.has(format)) throw new Error(`Unsupported image format: ${format}`);
  if (asset.outputPattern) {
    const aspect = asset.aspects[aspectName];
    const height = Math.round((width * aspect.height) / aspect.width);
    return asset.outputPattern
      .replaceAll('{width}', String(width))
      .replaceAll('{height}', String(height))
      .replaceAll('{format}', format);
  }
  return `${asset.outputStem}-${aspectName}-${width}.${format}`;
}

function getResponsiveImageData(registry, assetId, aspectName) {
  const asset = registry.assets[assetId];
  if (!asset) throw new Error(`Unknown image asset: ${assetId}`);
  const aspect = asset.aspects[aspectName];
  if (!aspect) throw new Error(`Asset ${assetId} has no ${aspectName} aspect`);

  const sources = {};
  const formats = asset.formats || registry.variants.formats;
  for (const format of formats) {
    sources[format] = aspect.widths.map((width) => ({
      src: buildVariantUrl(asset, aspectName, width, format),
      width,
    }));
  }
  const fallbackFormat = asset.fallbackFormat || registry.variants.fallbackFormat || 'webp';
  const fallback = sources[fallbackFormat][sources[fallbackFormat].length - 1];

  return {
    assetId,
    role: asset.role,
    visible: asset.visible,
    sitemap: asset.sitemap,
    src: fallback.src,
    width: aspect.width,
    height: aspect.height,
    aspect: aspectName,
    sources,
  };
}

function getPageResponsiveImages(registry, canonicalPathOrOptions, lang) {
  const page = getPageImageSet(registry, canonicalPathOrOptions, lang);
  if (!page) return null;
  return Object.fromEntries(
    Object.entries(page.images).map(([role, image]) => [
      role,
      {
        ...image,
        ...getResponsiveImageData(registry, image.assetId, image.aspect),
      },
    ])
  );
}

function renderResponsivePicture(registry, imageRef, options = {}) {
  const image = getResponsiveImageData(registry, imageRef.assetId, imageRef.aspect);
  const sizes = options.sizes || imageRef.sizes || '(max-width: 768px) 100vw, 1200px';
  const priority = options.priority === true;
  const asset = registry.assets[imageRef.assetId];
  const formats = asset.formats || registry.variants.formats;
  const sources = formats
    .filter((format) => format !== 'jpg')
    .map((format) => {
      const srcset = image.sources[format]
        .map((variant) => `${variant.src} ${variant.width}w`)
        .join(', ');
      return `    <source type="image/${format}" srcset="${srcset}" sizes="${escapeHtml(sizes)}">`;
    })
    .join('\n');
  const webpSrcset = image.sources.webp
    .map((variant) => `${variant.src} ${variant.width}w`)
    .join(', ');
  const loading = priority ? 'eager' : 'lazy';
  const priorityAttribute = priority ? ' fetchpriority="high"' : ' fetchpriority="low"';
  const img = `    <img src="${image.src}" srcset="${webpSrcset}" sizes="${escapeHtml(sizes)}" width="${image.width}" height="${image.height}" loading="${loading}" decoding="async"${priorityAttribute} alt="${escapeHtml(imageRef.alt)}">`;
  const picture = `<picture>\n${sources}\n${img}\n  </picture>`;
  if (options.figure === false) return picture;
  const caption = imageRef.caption
    ? `\n  <figcaption>${escapeHtml(imageRef.caption)}</figcaption>`
    : '';
  return `<figure class="seo-image seo-image--${image.role}">\n  ${picture}${caption}\n</figure>`;
}

module.exports = {
  DEFAULT_REGISTRY_PATH,
  REPO_ROOT,
  buildVariantUrl,
  getPageImageSet,
  getPageResponsiveImages,
  getResponsiveImageData,
  normalizeCanonicalPath,
  readImageAssetRegistry,
  renderResponsivePicture,
  resolveRepoPath,
  validateImageAssetRegistry,
};
