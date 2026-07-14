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
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__noctaliaCls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
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
      return {
        editorial: inspect('editorial'),
        educational: inspect('educational'),
        cls: Number(window.__noctaliaCls || 0),
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
    desktop: { width: 1440, height: 1000 },
  };
  const errors = [];
  const results = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const [pathname] of Object.entries(registry.pages)) {
      for (const [label, viewport] of Object.entries(viewports)) {
        const result = await inspectPage(browser, baseUrl, pathname, viewport);
        results.push({ pathname, viewport: label, cls: result.cls });
        for (const role of ['editorial', 'educational']) {
          const image = result[role];
          if (image.count !== 1 || !image.visible || !image.loaded || !image.currentSrc) {
            errors.push(`${pathname} (${label}): ${role} image is missing, hidden or unloaded`);
          }
          if (!image.alt || !image.caption) {
            errors.push(`${pathname} (${label}): ${role} image lacks localized context`);
          }
        }
        if (result.editorial.fetchPriority !== 'high' || result.editorial.loading === 'lazy') {
          errors.push(`${pathname} (${label}): editorial image is not the priority image`);
        }
        if (result.educational.loading !== 'lazy' || result.educational.fetchPriority === 'high') {
          errors.push(`${pathname} (${label}): educational image has the wrong loading policy`);
        }
        const expectedEducationalAspect = label === 'mobile' ? '-3x4-' : '-4x3-';
        if (!result.educational.currentSrc.includes(expectedEducationalAspect)) {
          errors.push(
            `${pathname} (${label}): educational image did not select the ${expectedEducationalAspect.slice(1, -1)} composition`
          );
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
  console.log(`[image-seo-browser] Passed: ${results.length} mobile/desktop page checks, max CLS ${maxCls.toFixed(4)}.`);
}

main().catch((error) => {
  console.error(`[image-seo-browser] Failed: ${error.stack || error.message || error}`);
  process.exit(1);
});
