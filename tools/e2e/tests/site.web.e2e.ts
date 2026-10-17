import { readFileSync } from 'node:fs';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('the generated English homepage opens a real internal destination', async ({ app, screen, browser }) => {
  await app.open('/en/');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const links = screen.getByRole('link');
  const candidates = await links.all();
  let destination: string | undefined;
  for (const link of candidates) {
    const href = await link.getAttribute('href');
    if (!href) continue;
    const url = new URL(href, app.baseUrl);
    if (url.origin === new URL(app.baseUrl!).origin && url.pathname !== '/en/' && !url.hash && await link.isVisible()) {
      destination = url.pathname;
      await link.tap();
      break;
    }
  }
  expect(destination, 'The homepage exposes an internal navigation link').toBeDefined();
  await expect(browser).toHaveURL(destination!);
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await app.screenshot('internal-navigation');
});


// Decode real images and measure the rendered page: HTML checks cannot catch
// a top gap, navbar overlap, viewport overflow or a missing uploaded variant.
// The owner chose a 2560px display cap; the new artwork remains native 1600px.
async function measureHero() {
  const img = document.querySelector<HTMLImageElement>('.symbol-hero img')!;
  await img.decode();
  await document.fonts.ready;
  const box = img.getBoundingClientRect();
  const hero = document.querySelector('.symbol-hero')!.getBoundingClientRect();
  const nav = document.querySelector('#navbar')!;
  const heading = document.querySelector('h1')!.getBoundingClientRect();
  const breadcrumb = document.querySelector('.symbol-breadcrumb')!;
  return {
    src: img.currentSrc, naturalWidth: img.naturalWidth,
    width: box.width, height: box.height, left: box.left, top: box.top,
    heroTop: hero.top, heroBottom: hero.bottom,
    available: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    navBottom: nav.getBoundingClientRect().bottom,
    navBackground: getComputedStyle(nav).backgroundColor,
    headingTop: heading.top, headingBottom: heading.bottom,
    breadcrumbTop: getComputedStyle(breadcrumb).display === 'none' ? null : breadcrumb.getBoundingClientRect().top,
    objectFit: getComputedStyle(img).objectFit,
  };
}

test('symbol artwork fills the page from behind the navbar up to 2560px', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')) as {
    symbols: Array<{ id: string; fr: { slug: string; name: string } }>;
  };
  const ids = ['sex','cheating','kissing','attack','killing','fighting','eating','kidnapping','moving-house','war','vomiting','nails','tsunami','flowers','tiger','deer','pig','monkey','lizard','bat','toilet','church','beach','castle','swimming-pool','alien','celebrity','boss','crush','witch','clown','gun','knife','wallet','doll','gold','coffin','stars','sky','god'];
  const checkLayout = (image: Awaited<ReturnType<typeof measureHero>>) => {
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.width).toBeCloseTo(Math.min(image.available, 2560), 0);
    expect(image.left).toBeCloseTo((image.available - image.width) / 2, 0);
    expect(image.top).toBe(0);
    expect(image.heroTop).toBe(0);
    expect(image.width / image.height).toBeCloseTo(16 / 9, 2);
    expect(image.objectFit).toBe('contain');
    expect(image.navBackground).toBe('rgba(0, 0, 0, 0)');
    expect(image.headingTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.headingBottom).toBeLessThanOrEqual(image.heroBottom);
    if (image.breadcrumbTop !== null) expect(image.breadcrumbTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.overflow).toBe(false);
  };
  await browser.setViewport({ width: 3840, height: 2160 });
  for (const id of ids) {
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    expect(image.src).toMatch(new RegExp('/' + id + '-v1-[0-9]+w\\.(?:webp|avif)$'));
    checkLayout(image);
    if (['sex', 'tiger', 'god'].includes(id)) await app.screenshot('symbol-' + id + '-wide');
  }
  for (const [width, height, id] of [
    [1920, 1200, 'angel'], [2560, 1600, 'tiger'], [2568, 1600, 'angel'],
    [390, 844, 'tiger'], [390, 844, 'angel'], [320, 740, 'moving-house'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    checkLayout(await browser.evaluate(measureHero));
    await app.screenshot('symbol-' + id + '-' + width);
  }
});

// Living-painting pilot of the French tiger page (mist + lantern glow). The
// script, its layers and the tag that loads them are only checkable in a real
// browser: decoded layers, running CSS animations, media queries and the
// pause control. The painting itself must never move or change.
const TIGER_PILOT = '/js/tiger-living/4a2c0644fe77/tiger-living-painting.js';
const TIGER_PAUSE = 'Pause de l’animation du décor';

function readTigerPilot() {
  const hero = document.querySelector<HTMLElement>('.symbol-hero')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const stage = hero.querySelector<HTMLElement>('.tlp-stage');
  const mist = hero.querySelector<HTMLImageElement>('.tlp-mist-tex');
  const glow = hero.querySelector<HTMLElement>('.tlp-glow');
  const box = img.getBoundingClientRect();
  const frame = stage?.getBoundingClientRect();
  return {
    living: hero.getAttribute('data-tiger-living'),
    state: hero.getAttribute('data-tiger-motion-state'),
    reasons: hero.getAttribute('data-tiger-motion-reasons'),
    painting: { src: img.currentSrc, left: box.left, top: box.top, width: box.width, height: box.height },
    paintingAnimations: img.getAnimations().length,
    stage: frame ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height } : null,
    mistSrc: mist ? mist.currentSrc : null,
    mistTransform: mist ? getComputedStyle(mist).transform : null,
    glowOpacity: glow ? getComputedStyle(glow).opacity : null,
    // Layer keyframes only: the stage's fade-in is a transition, not motion.
    playStates: document.getAnimations()
      .filter(animation => animation instanceof CSSAnimation && (animation.effect as KeyframeEffect | null)?.target?.closest('.tlp-stage'))
      .map(animation => animation.playState),
    toggles: hero.querySelectorAll('.tlp-toggle').length,
  };
}

function readPilotLoads() {
  return {
    scripts: document.querySelectorAll('script[src*="tiger-living"]').length,
    requests: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/tiger-living/')).length,
    stages: document.querySelectorAll('.tlp-stage, .tlp-toggle').length,
    marked: document.querySelector('.symbol-hero')?.hasAttribute('data-tiger-living') ?? null,
    loaded: document.readyState === 'complete',
  };
}

type TigerPilot = Awaited<ReturnType<typeof readTigerPilot>>;

const expectStillPainting = (now: TigerPilot, before: TigerPilot['painting']) => {
  expect(now.painting).toEqual(before);
  expect(now.painting.src).toMatch(/\/tiger-v1-[0-9]+w\.(?:webp|avif)$/);
  expect(now.paintingAnimations).toBe(0);
};

test('the French tiger painting gains mist and lantern glow that pause, resume and respect reduced motion', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  for (const [width, height, mistLayer] of [[2560, 1440, 'mist.webp'], [390, 844, 'mist-mobile.webp']] as const) {
    // The harness allows only route and viewport steps before the first app.open;
    // each pass ends with reduced motion turned back off.
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('ready');
    const first = await browser.evaluate(readTigerPilot);
    expect(first.state).toBe('running');
    expect(first.mistSrc).toMatch(new RegExp('/js/tiger-living/4a2c0644fe77/assets/' + mistLayer.replace('.', '\\.') + '$'));
    // The layers sit on the painted frame (16:9 hero, object-fit contain).
    for (const key of ['left', 'top', 'width', 'height'] as const) expect(first.stage![key]).toBeCloseTo(first.painting[key], 0);
    expect(first.playStates.length).toBeGreaterThan(0);
    expect(first.playStates.every(state => state === 'running')).toBe(true);

    // Layers move while the painting stays put.
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.mistTransform), { timeout: 10_000 }).not.toBe(first.mistTransform);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.glowOpacity), { timeout: 10_000 }).not.toBe(first.glowOpacity);
    expectStillPainting(await browser.evaluate(readTigerPilot), first.painting);

    // Pause with a tap, resume from the keyboard; the control keeps a 44px target.
    const toggle = screen.getByRole('button', TIGER_PAUSE);
    await expect(toggle).toBeVisible();
    const target = (await toggle.boundingBox())!;
    expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(44);
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const paused = await browser.evaluate(readTigerPilot);
    expect([paused.state, paused.reasons]).toEqual(['paused', 'user']);
    expect(paused.playStates.length).toBeGreaterThan(0);
    expect(paused.playStates.every(state => state === 'paused')).toBe(true);
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const resumed = await browser.evaluate(readTigerPilot);
    expect(resumed.state).toBe('running');
    expect(resumed.playStates.every(state => state === 'running')).toBe(true);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.mistTransform), { timeout: 10_000 }).not.toBe(resumed.mistTransform);

    // Scrolled away, the layers stop; back in view, they run again.
    await browser.evaluate(() => { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); return window.scrollY; });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.state, read.reasons])).toEqual(['paused', 'offscreen']);
    expect(await browser.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); return window.scrollY; })).toBe(0);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.state)).toBe('running');

    // A live reduced-motion preference stops every layer animation and hides the control.
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.state)).toBe('reduced');
    await expect(toggle).toBeHidden();
    const reduced = await browser.evaluate(readTigerPilot);
    expect(reduced.playStates).toEqual([]);
    expect(reduced.mistTransform).toBe('none');
    expectStillPainting(reduced, first.painting);
    await app.screenshot('tiger-living-reduced-' + width);
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.state)).toBe('running');
    await expect(toggle).toBeVisible();
    await app.screenshot('tiger-living-' + width);
  }
});

test('a broken layer or reduced motion from the first load keeps the tiger painting still', async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 1920, height: 1080 });
  await browser.route('**/js/tiger-living/4a2c0644fe77/assets/lantern-glow.webp', route => route.fulfill({ status: 404, body: '' }));
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('off');
  const broken = await browser.evaluate(readTigerPilot);
  expect([broken.stage, broken.toggles, broken.state, broken.playStates]).toEqual([null, 0, null, []]);
  expect(broken.painting.src).toMatch(/\/tiger-v1-[0-9]+w\.(?:webp|avif)$/);
  expect(broken.paintingAnimations).toBe(0);

  await browser.unroute('**/js/tiger-living/4a2c0644fe77/assets/lantern-glow.webp');
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('ready');
  const reduced = await browser.evaluate(readTigerPilot);
  expect(reduced.state).toBe('reduced');
  expect(reduced.playStates).toEqual([]);
  expect(reduced.mistTransform).toBe('none');
  expectStillPainting(reduced, broken.painting);
  await expect(screen.getByRole('button', TIGER_PAUSE)).toBeHidden();
});

test('no other symbol or language loads the living-painting pilot', async ({ app, browser, screen }) => {
  const html = readFileSync(new URL('../../../docs/fr/symboles/tigre.html', import.meta.url), 'utf8');
  expect(html).toContain(`<script src="${TIGER_PILOT}" defer></script>`);
  for (const path of ['/fr/symboles/cerf.html', '/en/symbols/tiger.html', '/es/simbolos/tigre.html', '/de/traumsymbole/tiger.html', '/it/simboli/tigre.html']) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readPilotLoads).then(read => read.loaded)).toBe(true);
    expect(await browser.evaluate(readPilotLoads)).toEqual({ scripts: 0, requests: 0, stages: 0, marked: false, loaded: true });
  }
});
