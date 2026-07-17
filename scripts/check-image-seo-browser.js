#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { DOCS_DIR } = require('./lib/docs-site-config');
const { walkFiles } = require('./lib/docs-source-utils');
const { readImageAssetRegistry } = require('./lib/image-seo-assets');
const {
  listPageIllustrationRoutes,
  readCompleteImageAssetRegistry,
} = require('./lib/page-illustrations');

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function renderedEditorialPages() {
  const pages = {};
  for (const filePath of walkFiles(DOCS_DIR, (candidate) => candidate.endsWith('.html'))) {
    const html = fs.readFileSync(filePath, 'utf8');
    if (!/data-image-seo-role=(['"])editorial\1/i.test(html)) continue;
    const kind = /<html\b[^>]*\bclass=(['"])[^"']*\bblog-article\b/i.test(html)
      ? 'article'
      : /<body\b[^>]*\bclass=(['"])[^"']*\bdictionary-page\b/i.test(html)
        ? 'guide'
        : null;
    if (!kind) continue;
    const relativePath = path.relative(DOCS_DIR, filePath).split(path.sep).join('/');
    const pathname = `/${relativePath}`
      .replace(/\/index\.html$/, '/')
      .replace(/\.html$/, '');
    pages[pathname] = { kind, images: null };
  }
  return pages;
}

function sitewideIllustrationPages() {
  return Object.fromEntries(
    listPageIllustrationRoutes().map((route) => [route.path, {
      kind: route.pageId.startsWith('blog.') ? 'article' : 'page',
      images: null,
    }])
  );
}

async function inspectPage(browser, baseUrl, pathname, viewport, expectEducational) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    window.__noctaliaCls = 0;
    window.__noctaliaLcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__noctaliaCls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries.at(-1);
      if (latest) window.__noctaliaLcp = latest.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  try {
    let response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'domcontentloaded' });
    if (response?.status() === 404 && !pathname.endsWith('/')) {
      response = await page.goto(`${baseUrl}${pathname}.html`, { waitUntil: 'domcontentloaded' });
    }
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() || 'unknown'}`);

    const educational = page.locator('[data-image-seo-role="educational"]');
    if (expectEducational) await educational.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-image-seo-role] img')]
        .every((image) => image.complete && image.naturalWidth > 0),
      null,
      { timeout: 15_000 }
    );

    return await page.evaluate(() => {
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const inspect = (role) => {
        const figure = document.querySelector(`[data-image-seo-role="${role}"]`);
        const image = figure?.querySelector('img');
        return {
          count: document.querySelectorAll(`[data-image-seo-role="${role}"]`).length,
          imgCount: figure?.querySelectorAll('img').length || 0,
          visible: visible(figure) && visible(image),
          loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
          currentSrc: image?.currentSrc || '',
          naturalWidth: image?.naturalWidth || 0,
          naturalHeight: image?.naturalHeight || 0,
          width: image?.width || 0,
          height: image?.height || 0,
          loading: image?.loading || '',
          fetchPriority: image?.fetchPriority || '',
          alt: image?.alt || '',
          caption: figure?.querySelector('figcaption')?.textContent?.trim() || '',
        };
      };
      const hero = document.querySelector('[data-image-seo-hero="true"]');
      const heroFigure = hero?.querySelector('[data-image-seo-role="editorial"]');
      const heroIntro = hero ? [...hero.children].find((element) => element.tagName === 'P') : null;
      const breadcrumb = hero?.previousElementSibling?.matches('nav[aria-label="Breadcrumb"]')
        ? hero.previousElementSibling
        : null;
      const heroFigureRect = heroFigure?.getBoundingClientRect();
      const heroRect = hero?.getBoundingClientRect();
      const heroIntroRect = heroIntro?.getBoundingClientRect();
      const breadcrumbRect = breadcrumb?.getBoundingClientRect();
      const heroCopy = hero
        ? [...hero.children].find(
          (element) => element !== heroFigure && element.querySelector?.('h1')
        )
        : null;
      const heroCopyRect = heroCopy?.getBoundingClientRect();
      return {
        editorial: inspect('editorial'),
        educational: inspect('educational'),
        hero: {
          copyCount: heroCopy ? 1 : 0,
          startsAtTop: Boolean(
            heroFigureRect && heroRect && heroFigureRect.top <= heroRect.top + 1
          ),
          figureHeight: heroFigureRect?.height || 0,
          introBelowImage: Boolean(
            heroFigureRect && heroIntroRect && heroIntroRect.top >= heroFigureRect.bottom - 1
          ),
          breadcrumbOverImage: Boolean(
            !visible(breadcrumb) ||
            (heroFigureRect && breadcrumbRect &&
              breadcrumbRect.top >= heroFigureRect.top &&
              breadcrumbRect.bottom <= heroFigureRect.bottom)
          ),
          copyWithinImage: Boolean(
            heroFigureRect && heroCopyRect &&
            heroCopyRect.top >= heroFigureRect.top - 1 &&
            heroCopyRect.bottom <= heroFigureRect.bottom + 1
          ),
        },
        horizontalOverflow: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0
        ) > window.innerWidth + 1,
        cls: Number(window.__noctaliaCls || 0),
        lcp: Number(window.__noctaliaLcp || 0),
      };
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const baseUrl = argumentValue('base-url', 'http://127.0.0.1:8000').replace(/\/$/, '');
  const registry = process.argv.includes('--sitewide')
    ? readCompleteImageAssetRegistry()
    : readImageAssetRegistry();
  const pages = process.argv.includes('--sitewide')
    ? sitewideIllustrationPages()
    : process.argv.includes('--all-editorial')
      ? { ...renderedEditorialPages(), ...registry.pages }
      : registry.pages;
  const viewports = {
    mobile: { width: 390, height: 844 },
    tablet: { width: 1024, height: 1366 },
    desktop: { width: 1440, height: 1000 },
  };
  const errors = [];
  const results = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const [pathname, pageConfig] of Object.entries(pages)) {
      for (const [label, viewport] of Object.entries(viewports)) {
        const result = await inspectPage(
          browser,
          baseUrl,
          pathname,
          viewport,
          Boolean(pageConfig.images?.educational)
        );
        results.push({ pathname, viewport: label, cls: result.cls, lcp: result.lcp });
        const roles = pageConfig.images?.educational
          ? ['editorial', 'educational']
          : ['editorial'];
        for (const role of roles) {
          const image = result[role];
          if (
            image.count !== 1 ||
            image.imgCount !== 1 ||
            !image.visible ||
            !image.loaded ||
            !image.currentSrc
          ) {
            errors.push(`${pathname} (${label}): ${role} image is missing, hidden or unloaded`);
          }
          if (!image.alt || (pageConfig.images && !image.caption)) {
            errors.push(`${pathname} (${label}): ${role} image lacks localized context`);
          }
        }
        if (
          result.editorial.fetchPriority !== 'high' ||
          result.editorial.loading === 'lazy' ||
          (pageConfig.images && result.editorial.loading !== 'eager')
        ) {
          errors.push(`${pathname} (${label}): editorial image is not the priority image`);
        }
        if (pageConfig.images?.educational && (
          result.educational.loading !== 'lazy' || result.educational.fetchPriority === 'high'
        )) {
          errors.push(`${pathname} (${label}): educational image has the wrong loading policy`);
        }
        const expectedAspect = (imageRef, role) => {
          const asset = registry.assets[imageRef.assetId];
          const mobileAspect = imageRef.mobileAspect || (
            role === 'educational' && asset?.aspects?.['3x4'] ? '3x4' : null
          );
          const breakpoint = Number.parseInt(imageRef.mobileBreakpoint || '640px', 10);
          return mobileAspect && viewport.width <= breakpoint
            ? mobileAspect
            : imageRef.aspect;
        };
        if (pageConfig.images) {
          const expectedEditorialAspect = `-${expectedAspect(pageConfig.images.editorial, 'editorial')}-`;
          if (!result.editorial.currentSrc.includes(expectedEditorialAspect)) {
            errors.push(
              `${pathname} (${label}): editorial image did not select the ${expectedEditorialAspect.slice(1, -1)} composition`
            );
          }
          const expectedEducationalAspect = `-${expectedAspect(pageConfig.images.educational, 'educational')}-`;
          if (!result.educational.currentSrc.includes(expectedEducationalAspect)) {
            errors.push(
              `${pathname} (${label}): educational image did not select the ${expectedEducationalAspect.slice(1, -1)} composition`
            );
          }
        }
        if (
          result.hero.copyCount !== 1 ||
          !result.hero.startsAtTop ||
          !result.hero.copyWithinImage ||
          (pageConfig.kind === 'article' && !result.hero.introBelowImage)
        ) {
          errors.push(`${pathname} (${label}): responsive hero does not start at the top with the expected hierarchy`);
        }
        if (
          viewport.width > 520 &&
          result.hero.figureHeight < viewport.height * 0.72
        ) {
          errors.push(`${pathname} (${label}): hero image does not fill enough of the upper viewport`);
        }
        if (result.horizontalOverflow) {
          errors.push(`${pathname} (${label}): page has horizontal overflow`);
        }
        if (result.cls > 0.1) {
          errors.push(`${pathname} (${label}): CLS ${result.cls.toFixed(4)} exceeds 0.1`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    console.error(`[image-seo-browser] Failed (${errors.length} issue(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const maxCls = Math.max(...results.map((result) => result.cls));
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  };
  const lcpByViewport = Object.keys(viewports)
    .map((viewport) => {
      const values = results
        .filter((result) => result.viewport === viewport && result.lcp > 0)
        .map((result) => result.lcp);
      return `${viewport} ${values.length > 0 ? `${median(values).toFixed(0)} ms` : 'n/a'}`;
    })
    .join(', ');
  console.log(
    `[image-seo-browser] Passed: ${results.length} mobile/tablet/desktop page checks, ` +
    `max CLS ${maxCls.toFixed(4)}, median local LCP: ${lcpByViewport}.`
  );
}

main().catch((error) => {
  console.error(`[image-seo-browser] Failed: ${error.stack || error.message || error}`);
  process.exit(1);
});
