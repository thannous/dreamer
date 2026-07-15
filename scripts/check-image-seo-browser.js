#!/usr/bin/env node

'use strict';

const { chromium } = require('playwright');
const { readImageAssetRegistry } = require('./lib/image-seo-assets');

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function inspectPage(browser, baseUrl, pathname, viewport) {
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
    await educational.scrollIntoViewIfNeeded();
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
      const hero = document.querySelector('header[data-image-seo-hero="true"]');
      const heroFigure = hero?.querySelector('[data-image-seo-role="editorial"]');
      const heroIntro = hero ? [...hero.children].find((element) => element.tagName === 'P') : null;
      const heroFigureRect = heroFigure?.getBoundingClientRect();
      const heroIntroRect = heroIntro?.getBoundingClientRect();
      return {
        editorial: inspect('editorial'),
        educational: inspect('educational'),
        hero: {
          copyCount: hero?.querySelectorAll(':scope > .article-hero-copy').length || 0,
          introBelowImage: Boolean(
            heroFigureRect && heroIntroRect && heroIntroRect.top >= heroFigureRect.bottom - 1
          ),
        },
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
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
  const registry = readImageAssetRegistry();
  const viewports = {
    mobile: { width: 390, height: 844 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 1000 },
  };
  const errors = [];
  const results = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const [pathname, pageConfig] of Object.entries(registry.pages)) {
      for (const [label, viewport] of Object.entries(viewports)) {
        const result = await inspectPage(browser, baseUrl, pathname, viewport);
        results.push({ pathname, viewport: label, cls: result.cls, lcp: result.lcp });
        for (const role of ['editorial', 'educational']) {
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
          if (!image.alt || !image.caption) {
            errors.push(`${pathname} (${label}): ${role} image lacks localized context`);
          }
        }
        if (result.editorial.fetchPriority !== 'high' || result.editorial.loading !== 'eager') {
          errors.push(`${pathname} (${label}): editorial image is not the priority image`);
        }
        if (result.educational.loading !== 'lazy' || result.educational.fetchPriority === 'high') {
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
        if (
          pageConfig.kind === 'article' &&
          viewport.width <= 768 &&
          (result.hero.copyCount !== 1 || !result.hero.introBelowImage)
        ) {
          errors.push(`${pathname} (${label}): mobile hero hierarchy is not applied`);
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
