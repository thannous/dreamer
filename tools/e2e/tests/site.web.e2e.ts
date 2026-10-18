import { createHash } from 'node:crypto';
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
    paintings: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
      .filter(path => path.startsWith('/img/seo/symbols-v2/') || /\/tiger-mobile-v4-[0-9]+w\./.test(path)),
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
    [390, 844, 'angel'], [320, 740, 'moving-house'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    checkLayout(await browser.evaluate(measureHero));
    await app.screenshot('symbol-' + id + '-' + width);
  }
  // Only the French tiger page, on a phone held upright, takes 75svh with its
  // dedicated portrait painting (cover), fetched alone; the title stays under the face.
  for (const [width, height] of [[390, 844], [360, 780]] as const) {
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    expect(image.src).toMatch(/\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/);
    expect(image.paintings).toEqual([new URL(image.src).pathname]);
    expect(image.objectFit).toBe('cover');
    expect([image.heroTop, image.top, image.left]).toEqual([0, 0, 0]);
    expect(image.width).toBeCloseTo(image.available, 0);
    expect(image.height).toBeCloseTo(height * 0.75, 0);
    expect(image.heroBottom).toBeCloseTo(height * 0.75, 0);
    expect(image.navBackground).toBe('rgba(0, 0, 0, 0)');
    expect(image.headingTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.headingBottom).toBeLessThanOrEqual(image.heroBottom);
    const scale = Math.max(image.width / PORTRAIT.w, image.height / PORTRAIT.h);
    const faceBottom = image.top + (image.height - PORTRAIT.h * scale) * 0.35 + PORTRAIT.faceBottom * scale;
    expect(image.headingTop).toBeGreaterThan(faceBottom);
    expect(image.overflow).toBe(false);
    await app.screenshot('symbol-tiger-portrait-' + width);
  }
});

// Living-painting pilot of the French tiger page (mist, lantern glow, scroll
// depth). Decoded layers, running CSS animations, media queries, the source the
// browser picked and scroll geometry are only checkable in a real browser. The
// painting never animates itself; it only moves with its layers on scroll.
const TIGER_PAUSE = 'Pause de l’animation du décor';
// Painted landmarks, in source pixels: lantern centre for the glow, face bottom for the title.
const LANDSCAPE = { w: 1600, h: 900, lantern: [292, 163] };
const PORTRAIT = { w: 984, h: 1599, lantern: [244, 378], faceBottom: 925 };
const PARALLAX = 0.2;

function tigerPilotScript() {
  const html = readFileSync(new URL('../../../docs/fr/symboles/tigre.html', import.meta.url), 'utf8');
  const src = html.match(/<script src="(\/js\/tiger-living\/[0-9a-f]{12}\/tiger-living-painting\.js)" defer><\/script>/)?.[1];
  expect(src, 'The French tiger page loads one versioned pilot script').toBeDefined();
  return src!;
}

function readTigerPilot() {
  const rect = (node: Element | null) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const translate = (transform: string) => {
    const m = transform.match(/^matrix\(([^)]+)\)$/);
    return m ? m[1].split(',').slice(4).map(Number) : [0, 0];
  };
  const hero = document.querySelector<HTMLElement>('.symbol-hero')!;
  const figure = hero.querySelector<HTMLElement>('.symbol-hero-figure')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const box = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  // The painted frame of the displayed source: object-fit contain or cover, object-position in %.
  // While the browser swaps sources the new image has no size yet: fall back to the box.
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : box.width / box.height;
  const wide = box.width / box.height > ratio;
  const fitWidth = cs.objectFit === 'cover' ? wide : !wide;
  const width = fitWidth ? box.width : box.height * ratio;
  const height = fitWidth ? box.width / ratio : box.height;
  const [px, py] = cs.objectPosition.split(' ').map(parseFloat);
  const glow = hero.querySelector('.tlp-glow');
  return {
    living: hero.getAttribute('data-tiger-living'),
    scene: hero.getAttribute('data-tiger-scene'),
    state: hero.getAttribute('data-tiger-motion-state'),
    reasons: hero.getAttribute('data-tiger-motion-reasons'),
    painting: { src: img.currentSrc, left: box.left, top: box.top, width: box.width, height: box.height },
    paintingAnimations: img.getAnimations().length,
    frame: { left: box.left + (box.width - width) * px / 100, top: box.top + (box.height - height) * py / 100, width, height },
    hero: rect(hero)!,
    figure: rect(figure)!,
    figureShift: translate(getComputedStyle(figure).transform)[1],
    viewport: innerHeight,
    scrollY: window.scrollY,
    stage: rect(hero.querySelector('.tlp-stage')),
    glow: rect(glow),
    glowOpacity: glow ? Number(getComputedStyle(glow).opacity) : null,
    mist: Array.from(hero.querySelectorAll('.tlp-mist')).map(plane => ({
      src: plane.querySelector<HTMLImageElement>('.tlp-mist-tex')!.currentSrc,
      opacity: Number(getComputedStyle(plane).opacity),
      left: plane.querySelector('.tlp-mist-tex')!.getBoundingClientRect().left,
      scrollShift: translate(getComputedStyle(plane.querySelector('.tlp-mist-s')!).transform)[0],
    })),
    // Layer keyframes only: the stage's fade-in is a transition, not motion.
    playStates: document.getAnimations()
      .filter(animation => animation instanceof CSSAnimation && (animation.effect as KeyframeEffect | null)?.target?.closest('.tlp-stage'))
      .map(animation => animation.playState),
    toggles: hero.querySelectorAll('.tlp-toggle').length,
    paintings: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
      .filter(path => path.startsWith('/img/seo/symbols-v2/') || /\/tiger-mobile-v4-[0-9]+w\./.test(path)),
  };
}

// Seeks each mist texture to both ends of its drift and returns, per plane, the
// smallest margin between the window edges and the texture's opaque part (it
// fades out over 5 % at each end). Negative means a visible texture edge.
function mistCoverage() {
  return Array.from(document.querySelectorAll('.tlp-mist')).map(plane => {
    const tex = plane.querySelector('.tlp-mist-tex')!;
    const animations = tex.getAnimations().filter(animation => animation instanceof CSSAnimation);
    const frame = plane.getBoundingClientRect();
    let margin = Infinity;
    for (const end of [0.5, 1.5]) { // start at mid-course: half a period reaches one end, 1.5 the other
      for (const animation of animations) animation.currentTime = end * Number(animation.effect!.getComputedTiming().duration);
      const r = tex.getBoundingClientRect();
      margin = Math.min(margin, frame.left - (r.left + 0.05 * r.width), r.right - 0.05 * r.width - frame.right);
    }
    return Math.round(margin * 10) / 10;
  });
}

function readPilotLoads() {
  const hero = document.querySelector('.symbol-hero')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const box = img.getBoundingClientRect();
  return {
    scripts: document.querySelectorAll('script[src*="tiger-living"]').length,
    requests: performance.getEntriesByType('resource').filter(entry => /\/tiger-living\/|tiger-mobile-v4/.test(entry.name)).length,
    stages: document.querySelectorAll('.tlp-stage, .tlp-toggle').length,
    marked: hero.hasAttribute('data-tiger-living') || hero.classList.contains('symbol-hero--living'),
    ratio: Math.round(box.width / box.height * 100) / 100,
    objectFit: getComputedStyle(img).objectFit,
    loaded: document.readyState === 'complete' && img.complete,
  };
}

function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' });
  return window.scrollY;
}

type TigerPilot = Awaited<ReturnType<typeof readTigerPilot>>;

const sceneOf = (read: TigerPilot) => (read.scene === 'portrait' ? PORTRAIT : LANDSCAPE);

// Layers sit on the painted frame and the glow on the lantern, whatever the scroll.
const expectAligned = (read: TigerPilot) => {
  const scene = sceneOf(read);
  for (const key of ['left', 'top', 'width', 'height'] as const) expect(read.stage![key]).toBeCloseTo(read.frame[key], 0);
  expect(read.glow!.left + read.glow!.width / 2).toBeCloseTo(read.frame.left + scene.lantern[0] / scene.w * read.frame.width, 0);
  expect(read.glow!.top + read.glow!.height / 2).toBeCloseTo(read.frame.top + scene.lantern[1] / scene.h * read.frame.height, 0);
};

// No empty band: the painted frame covers the visible part of the hero.
const expectCovered = (read: TigerPilot) => {
  const top = Math.max(read.hero.top, 0), bottom = Math.min(read.hero.top + read.hero.height, read.viewport);
  expect(read.frame.top).toBeLessThanOrEqual(top + 0.5);
  expect(read.frame.top + read.frame.height).toBeGreaterThanOrEqual(bottom - 0.5);
  expect(read.frame.left).toBeLessThanOrEqual(read.hero.left + 0.5);
  expect(read.frame.left + read.frame.width).toBeGreaterThanOrEqual(read.hero.left + read.hero.width - 0.5);
};

const expectAtRest = (read: TigerPilot, before: TigerPilot['painting']) => {
  expect(read.figureShift).toBe(0);
  expect(read.mist.map(plane => plane.scrollShift)).toEqual(read.mist.map(() => 0));
  expect(read.painting).toEqual(before);
  expect(read.paintingAnimations).toBe(0);
};

test('the French tiger painting moves visibly, gains depth on scroll and stops on pause or reduced motion', { timeout: 180_000, video: 'on' }, async ({ app, browser, screen }) => {
  for (const [width, height, scene, mistLayer, painting, minDrift] of [
    [2560, 1440, 'landscape', 'mist.webp', /\/tiger-v1-1600w\.(?:webp|avif)$/, 30],
    [390, 844, 'portrait', 'mist-mobile.webp', /\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/, 15],
  ] as const) {
    // The harness allows only route and viewport steps before the first app.open;
    // each pass ends with reduced motion turned back off.
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('ready');
    const first = await browser.evaluate(readTigerPilot);
    expect([first.scene, first.state]).toEqual([scene, 'running']);
    expect(first.painting.src).toMatch(painting);
    expect(first.paintings).toEqual([new URL(first.painting.src).pathname]); // one painting fetched, never both
    expect(first.mist.map(plane => plane.src.split('/').pop())).toEqual([mistLayer, mistLayer]);
    expectAligned(first);
    expect(first.playStates.length).toBeGreaterThan(0);
    expect(first.playStates.every(state => state === 'running')).toBe(true);
    // The front mist plane is no longer diluted (V3 kept it near .25).
    expect(first.mist[0].opacity).toBeGreaterThanOrEqual(0.45);

    // Visible within three seconds of arrival: the front mist drifts at least minDrift
    // screen pixels and the lantern glow changes by .15, while the painting stays put.
    const started = Date.now();
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => Math.abs(read.mist[0].left - first.mist[0].left)), { timeout: 3_000 }).toBeGreaterThanOrEqual(minDrift);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => Math.abs(read.glowOpacity! - first.glowOpacity!)), { timeout: 3_000 - (Date.now() - started) }).toBeGreaterThanOrEqual(0.15);
    expect(Date.now() - started).toBeLessThanOrEqual(3_000);
    const moving = await browser.evaluate(readTigerPilot);
    expect(moving.painting).toEqual(first.painting);
    expect(moving.paintingAnimations).toBe(0);

    // Scroll down: painting and layers sink together by 20 % of the scroll, the mist
    // planes slide apart, the text keeps scrolling at full speed and no band opens.
    const down = Math.round(first.hero.height * 0.4);
    expect(await browser.evaluate(scrollToY, down)).toBe(down);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift)).toBeCloseTo(down * PARALLAX, 0);
    const scrolled = await browser.evaluate(readTigerPilot);
    expect(scrolled.hero.top).toBe(-down);
    expect(Math.sign(scrolled.mist[0].scrollShift)).toBe(-1);
    expect(Math.sign(scrolled.mist[1].scrollShift)).toBe(1);
    expectAligned(scrolled);
    expectCovered(scrolled);
    // Even at the deepest scroll, both mist textures cover their windows at either drift end.
    const deepest = Math.round(first.hero.height) - 2;
    expect(await browser.evaluate(scrollToY, deepest)).toBe(deepest);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift)).toBeCloseTo(deepest * PARALLAX, 0);
    expectCovered(await browser.evaluate(readTigerPilot));
    for (const margin of await browser.evaluate(mistCoverage)) expect(margin).toBeGreaterThanOrEqual(0);
    // And back up: everything returns to its starting place.
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift)).toBe(0);
    expectAtRest(await browser.evaluate(readTigerPilot), first.painting);

    // Pause with a tap, scrolled as far as the control stays below the navbar: layer
    // animations and the scroll depth stop and settle back to rest, and scrolling
    // while paused moves nothing. Resume from the keyboard; 44px target.
    const reach = await browser.evaluate(() => Math.floor(document.querySelector('.tlp-toggle')!.getBoundingClientRect().top - document.querySelector('#navbar')!.getBoundingClientRect().bottom - 4));
    expect(reach).toBeGreaterThan(10);
    expect(await browser.evaluate(scrollToY, reach)).toBe(reach);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift)).toBeCloseTo(reach * PARALLAX, 0);
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
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.figureShift, ...read.mist.map(plane => plane.scrollShift)]))
      .toEqual([0, 0, 0]);
    expect(await browser.evaluate(scrollToY, down)).toBe(down);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
    await toggle.press('Enter'); // focusing the control may scroll it back into view
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const resumed = await browser.evaluate(readTigerPilot);
    expect(resumed.state).toBe('running');
    expect(resumed.playStates.every(state => state === 'running')).toBe(true);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => Math.abs(read.figureShift - read.scrollY * PARALLAX) < 1)).toBe(true);
    expectAligned(await browser.evaluate(readTigerPilot));

    // Scrolled past the hero, the layers stop; back in view, they run again.
    await browser.evaluate(() => { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); return window.scrollY; });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.state, read.reasons])).toEqual(['paused', 'offscreen']);
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.state, read.figureShift])).toEqual(['running', 0]);

    // A live reduced-motion preference stops every layer animation and the depth, and hides the control.
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.state)).toBe('reduced');
    await expect(toggle).toBeHidden();
    expect(await browser.evaluate(scrollToY, down)).toBe(down);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
    const reduced = await browser.evaluate(readTigerPilot);
    expect(reduced.playStates).toEqual([]);
    expectAtRest(reduced, { ...first.painting, top: first.painting.top - down });
    expectAligned(reduced);
    await app.screenshot('tiger-living-reduced-' + width);
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.state)).toBe('running');
    await expect(toggle).toBeVisible();
    await app.screenshot('tiger-living-' + width);
  }
});

test('the tiger layers follow the painting the browser shows when the phone turns', async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/fr/symboles/tigre.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.living, read.scene]), { timeout: 15_000 }).toEqual(['ready', 'portrait']);
  expectAligned(await browser.evaluate(readTigerPilot));
  for (const [width, height, scene, painting] of [
    [700, 390, 'landscape', /\/tiger-v1-[0-9]+w\.(?:webp|avif)$/], // narrow but held sideways
    [1280, 720, 'landscape', /\/tiger-v1-[0-9]+w\.(?:webp|avif)$/],
    [390, 844, 'portrait', /\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/],
  ] as const) {
    await browser.setViewport({ width, height });
    await expect.poll(() => browser.evaluate(readTigerPilot).then(read => [read.scene, painting.test(read.painting.src)]), { timeout: 15_000 }).toEqual([scene, true]);
    const read = await browser.evaluate(readTigerPilot);
    // Landscape keeps the 16:9 contain hero; portrait takes 75svh with cover.
    if (scene === 'landscape') expect(read.hero.width / read.hero.height).toBeCloseTo(16 / 9, 2);
    else expect(read.hero.height).toBeCloseTo(height * 0.75, 0);
    await expect.poll(() => browser.evaluate(readTigerPilot).then(next => Math.abs(next.stage!.width - next.frame.width) < 0.5)).toBe(true);
    expectAligned(await browser.evaluate(readTigerPilot));
    expect(read.state).toBe('running');
  }
});

test('a broken layer or reduced motion from the first load keeps the tiger painting still', async ({ app, browser, screen }) => {
  const dir = tigerPilotScript().replace(/\/[^/]+$/, '');
  await browser.setViewport({ width: 1920, height: 1080 });
  await browser.route('**' + dir + '/assets/lantern-glow.webp', route => route.fulfill({ status: 404, body: '' }));
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('off');
  const broken = await browser.evaluate(readTigerPilot);
  expect([broken.stage, broken.toggles, broken.state, broken.scene, broken.playStates]).toEqual([null, 0, null, null, []]);
  expect(broken.painting.src).toMatch(/\/tiger-v1-[0-9]+w\.(?:webp|avif)$/);
  expect(broken.paintingAnimations).toBe(0);
  expect(await browser.evaluate(scrollToY, 300)).toBe(300);
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
  expect(await browser.evaluate(scrollToY, 0)).toBe(0);

  await browser.unroute('**' + dir + '/assets/lantern-glow.webp');
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.living), { timeout: 15_000 }).toBe('ready');
  const reduced = await browser.evaluate(readTigerPilot);
  expect(reduced.state).toBe('reduced');
  expect(reduced.playStates).toEqual([]);
  expectAtRest(reduced, broken.painting);
  await expect(screen.getByRole('button', TIGER_PAUSE)).toBeHidden();
  expect(await browser.evaluate(scrollToY, 300)).toBe(300);
  await expect.poll(() => browser.evaluate(readTigerPilot).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
});

test('only the French tiger page loads the living-painting pilot, from a folder named after its hash', async ({ app, browser, screen }) => {
  const src = tigerPilotScript();
  const served = readFileSync(new URL('../../../docs' + src, import.meta.url));
  expect(src.split('/')[3]).toBe(createHash('sha256').update(served).digest('hex').slice(0, 12));
  // At the default 390x844 phone viewport, every other page keeps the 16:9 contain hero.
  for (const path of ['/fr/symboles/cerf.html', '/en/symbols/tiger.html', '/es/simbolos/tigre.html', '/de/traumsymbole/tiger.html', '/it/simboli/tigre.html']) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readPilotLoads).then(read => read.loaded)).toBe(true);
    expect(await browser.evaluate(readPilotLoads)).toEqual({ scripts: 0, requests: 0, stages: 0, marked: false, ratio: 1.78, objectFit: 'contain', loaded: true });
  }
});

// Atlas composition of the same page: the rail beside the opening plate only,
// reading, three scene cards and the tiger art side by side, then a band and
// the rest across the whole frame; one column on a phone. The native scene
// selector must show, in the band, the opening question and the next sentence
// of the matching published variation card.
function readAtlas() {
  const rect = (selector: string) => {
    const node = document.querySelector(selector);
    if (!node || getComputedStyle(node).display === 'none') return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width };
  };
  const flat = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, '');
  const visible = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result')).filter(node => getComputedStyle(node).display !== 'none');
  const shownBox = visible[0]?.getBoundingClientRect();
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  const label = checked ? document.querySelector(`label[for="${checked.id}"] .atlas-scene-variation`)?.textContent?.trim() ?? null : null;
  const card = Array.from(document.querySelectorAll('#variations .variation-card')).find(node => node.querySelector('h4')?.textContent?.trim() === label);
  return {
    viewport: document.documentElement.clientWidth,
    viewportHeight: window.innerHeight,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    article: rect('article.atlas'), rail: rect('.atlas-rail'), reading: rect('.atlas-reading'), scenes: rect('.atlas-scenes'),
    decor: rect('.atlas-decor'), band: rect('.atlas-band'), reflection: rect('#reflexion'), relatedBox: rect('#associes'),
    columns: Array.from(document.querySelectorAll('.atlas-band > .atlas-column')).map(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: Math.round(r.top + window.scrollY), right: r.right };
    }),
    cardsRight: Math.max(...Array.from(document.querySelectorAll('.atlas-scene')).map(node => node.getBoundingClientRect().right)),
    checked: checked?.value ?? null,
    checkedLabel: checked ? document.querySelector(`label[for="${checked.id}"] .atlas-scene-label`)?.textContent?.trim() ?? null : null,
    shownInView: shownBox ? shownBox.top >= 0 && shownBox.bottom <= window.innerHeight + 1 : false,
    shown: visible.map(node => ({
      scene: node.dataset.scene ?? '',
      inBand: Boolean(node.closest('#reflexion')),
      chosen: node.querySelector('.atlas-scene-chosen')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      question: node.querySelector('.atlas-scene-question')!.textContent!.trim(),
      excerpt: node.querySelector('.atlas-scene-excerpt')!.textContent!.trim(),
    })),
    card: card ? card.querySelector('p')!.textContent!.replace(/[ \t\r\n]+/g, ' ').trim() : null, // keeps French non-breaking spaces
    zones: { meaning: flat(document.querySelector('#meaning')), journal: flat(document.querySelector('#journal')), lecture: flat(document.querySelector('#lecture')) },
    headings: Array.from(document.querySelectorAll('article.atlas :is(h2, h3, h4)')).map(node => Number(node.tagName.slice(1))),
    chapters: Array.from(document.querySelectorAll('article.atlas h2')).map(node => node.textContent!.trim()),
    chaptersShown: Array.from(document.querySelectorAll('article.atlas h2')).map(node => node.getBoundingClientRect().width > 100),
    // The hero title reads "Signification : Tigre": the prefix sits above the name.
    titleInOrder: document.querySelector('h1 .symbol-h1-prefix')!.getBoundingClientRect().bottom <= document.querySelector('h1 > span:not(.symbol-h1-prefix)')!.getBoundingClientRect().top,
    ids: ['meaning', 'scenes', 'reflexion', 'journal', 'garder-noctalia', 'associes', 'lecture', 'questions', 'variations', 'faq'].filter(id => document.getElementById(id)),
    railTargets: Array.from(document.querySelectorAll<HTMLAnchorElement>('.atlas-rail a')).map(link => Boolean(document.getElementById(link.hash.slice(1)))),
    counts: {
      opening: document.querySelectorAll('#meaning .prose > p').length,
      continuation: document.querySelectorAll('#lecture .prose > p').length,
      journal: document.querySelectorAll('#journal blockquote').length,
      variations: document.querySelectorAll('#variations .variation-card').length,
      questions: document.querySelectorAll('#questions .symbol-question-item').length,
      faq: document.querySelectorAll('#faq .symbol-faq-card').length,
    },
    related: Array.from(document.querySelectorAll<HTMLAnchorElement>('#associes a.symbol-link')).map(link => link.getAttribute('href')),
    decorLoads: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/atlas-tiger-v1/tiger-atlas-vignette')).length,
  };
}

type Atlas = Awaited<ReturnType<typeof readAtlas>>;

// The band names the selected card and shows its opening question and the sentence after it.
const expectPublishedScene = (atlas: Atlas, scene: string) => {
  expect(atlas.checked).toBe(scene);
  expect(atlas.shown.map(shown => [shown.scene, shown.inBand])).toEqual([[scene, true]]);
  const [{ question, excerpt, chosen }] = atlas.shown;
  expect(chosen).toBe(`Votre scène : ${atlas.checkedLabel}`);
  expect(question.endsWith('?')).toBe(true);
  expect(atlas.card!.startsWith(question)).toBe(true);
  expect(atlas.card!.slice(question.length).trim().startsWith(excerpt)).toBe(true);
};

test('the French tiger atlas sets its chapters side by side and shows each published scene from mouse or keyboard', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  // Every paragraph of the published interpretation, whole, in its zone: the first opens the plate,
  // the fictional journal sits in the band, the others follow in the continuation.
  const extended = JSON.parse(readFileSync(new URL('../../../data/dream-symbols-extended.json', import.meta.url), 'utf8')) as {
    symbols: Record<string, { fr: { fullInterpretation: string } }>;
  };
  const source = (extended.symbols.tiger.fr.fullInterpretation.match(/<p>[\s\S]*?<\/p>/g) ?? [])
    .map(paragraph => paragraph.replace(/<[^>]+>/g, '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ''));
  expect(source).toHaveLength(5);

  for (const [width, height] of [[1586, 992], [1920, 1080]] as const) {
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const wide = await browser.evaluate(readAtlas);
    // About 90 % of the width; rail | reading | cards | art in the opening, never art behind the reading,
    // and the tiger's face (right 44 % of the art) clear of the cards.
    expect(wide.article!.width).toBeGreaterThanOrEqual(wide.viewport * 0.88);
    expect(wide.rail!.right).toBeLessThanOrEqual(wide.reading!.left);
    expect(wide.reading!.right).toBeLessThanOrEqual(wide.scenes!.left);
    expect(wide.scenes!.top).toBeLessThan(wide.reading!.bottom);
    expect(wide.decor!.left).toBeGreaterThanOrEqual(wide.reading!.right);
    expect(wide.decor!.width).toBeGreaterThanOrEqual(500);
    expect(wide.decor!.left + wide.decor!.width * 0.56).toBeGreaterThanOrEqual(wide.cardsRight - 1);
    // The band and the rest span the whole frame, under the rail, in three columns.
    expect(wide.rail!.bottom).toBeLessThanOrEqual(wide.band!.top);
    expect(wide.band!.left).toBeCloseTo(wide.article!.left, 0);
    expect(wide.band!.right).toBeCloseTo(wide.article!.right, 0);
    expect(wide.relatedBox!.left).toBeCloseTo(wide.article!.left, 0);
    expect(wide.columns).toHaveLength(3);
    expect(new Set(wide.columns.map(column => column.top)).size).toBe(1);
    for (let i = 1; i < wide.columns.length; i += 1) expect(wide.columns[i].left).toBeGreaterThanOrEqual(wide.columns[i - 1].right - 1);
    expect(wide.overflow).toBe(false);
    await app.screenshot('tiger-atlas-' + width);
  }

  const wide = await browser.evaluate(readAtlas);
  // Every published block, anchor and link survives, under a coherent h2 > h3 > h4 outline.
  expect(wide.ids).toEqual(['meaning', 'scenes', 'reflexion', 'journal', 'garder-noctalia', 'associes', 'lecture', 'questions', 'variations', 'faq']);
  expect(wide.railTargets.every(Boolean)).toBe(true);
  expect(wide.counts).toEqual({ opening: 1, continuation: 3, journal: 1, variations: 6, questions: 3, faq: 4 });
  source.forEach((paragraph, index) => {
    // The journal example keeps its label as the figure caption, without the trailing colon.
    const journal = paragraph.match(/^Exemplefictifdejournal\s*:/);
    const zone = journal ? 'journal' : index === 0 ? 'meaning' : 'lecture';
    if (journal) expect(wide.zones.journal.startsWith('Exemplefictifdejournal')).toBe(true);
    expect(wide.zones[zone].includes(journal ? paragraph.slice(journal[0].length) : paragraph), `interpretation paragraph ${index + 1} is whole in #${zone}`).toBe(true);
  });
  expect(wide.chapters).toEqual(['Reconnaître la scène', 'Ce qu’elle éveille', 'Relier à votre histoire']);
  expect(wide.chaptersShown).toEqual([true, true, true]);
  expect(wide.titleInOrder).toBe(true);
  expect(wide.headings[0]).toBe(2);
  wide.headings.forEach((level, index) => { if (index) expect(level).toBeLessThanOrEqual(wide.headings[index - 1] + 1); });
  expect(wide.related).toEqual(['/fr/symboles/lion', '/fr/symboles/chat', '/fr/symboles/poursuite', '/fr/symboles/loup']);
  expectPublishedScene(wide, 'poursuite');

  // Mouse on the visible cards, then the arrow keys of the native radio group, back round to the first.
  // A clicked card brings its reading, which sits below the cards, into view.
  expect(wide.shownInView).toBe(false);
  await screen.getByText('Il est calme').tap(); // the native radio is visually hidden behind its card
  await expect(screen.getByRole('radio', { name: /^Il est calme/ })).toBeChecked();
  await expect.poll(() => browser.evaluate(readAtlas).then(read => read.shownInView)).toBe(true);
  expectPublishedScene(await browser.evaluate(readAtlas), 'calme');
  await screen.getByRole('radio', { name: /^Il est calme/ }).press('ArrowDown');
  await expect(screen.getByRole('radio', { name: /^Il est en cage/ })).toBeChecked();
  expectPublishedScene(await browser.evaluate(readAtlas), 'cage');
  await screen.getByRole('radio', { name: /^Il est en cage/ }).press('ArrowDown');
  await expect(screen.getByRole('radio', { name: /^Il me poursuit/ })).toBeChecked();
  expectPublishedScene(await browser.evaluate(readAtlas), 'poursuite');

  // A phone: one column without overflow, the choices right after the opening and the
  // reflection right after them, and the hidden art never fetched.
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/fr/symboles/tigre.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await screen.getByText('Il est en cage').tap();
  await expect.poll(() => browser.evaluate(readAtlas).then(read => read.shownInView)).toBe(true);
  const phone = await browser.evaluate(readAtlas);
  expect(phone.overflow).toBe(false);
  expect([phone.rail, phone.decor, phone.decorLoads]).toEqual([null, null, 0]);
  expect(phone.scenes!.top).toBeGreaterThanOrEqual(phone.reading!.bottom);
  expect(phone.scenes!.top - phone.article!.top).toBeLessThan(2 * phone.viewportHeight);
  expect(phone.reflection!.top).toBeGreaterThanOrEqual(phone.scenes!.bottom);
  expect(phone.columns.map(column => column.left)).toEqual(phone.columns.map(() => phone.columns[0].left));
  expectPublishedScene(phone, 'cage');
  await app.screenshot('tiger-atlas-390');
  // Past the hero the shared navbar gets a ground over the text (it stays transparent on the hero).
  const navGround = () => browser.evaluate(() => getComputedStyle(document.querySelector('#navbar')!).backgroundColor);
  for (const [top, transparent] of [[1127, false], [760, false], [0, true]] as const) {
    expect(await browser.evaluate(scrollToY, top)).toBe(top);
    if (transparent) await expect.poll(navGround).toBe('rgba(0, 0, 0, 0)');
    else await expect.poll(navGround).toMatch(/^rgba\(10, 5, 20, 0\.9\d*\)$/);
  }

  // The phone section bar follows the page order: a tapped link lands its section below the bar
  // and stays lit past it (the FAQ comes after the variations), and the text never shows above
  // the bar, even once the navbar slides away.
  const readJump = () => browser.evaluate(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.symbol-jump-link'));
    const bar = document.querySelector('.symbol-jump-nav')!.getBoundingClientRect();
    return {
      hashes: links.map(link => link.hash),
      tops: links.map(link => document.querySelector(link.hash)!.getBoundingClientRect().top + window.scrollY),
      active: links.filter(link => link.classList.contains('is-active')).map(link => link.hash),
      covered: bar.top <= Math.max(0, document.querySelector('#navbar')!.getBoundingClientRect().bottom) + 8,
      barBottom: bar.bottom,
      variationsTitle: document.querySelector('#variations h3')!.getBoundingClientRect().top,
      faqTop: document.querySelector('#faq')!.getBoundingClientRect().top + window.scrollY,
    };
  });
  // Anchors scroll smoothly: read positions once the page has stopped.
  let lastY = -1;
  const settled = () => expect.poll(async () => {
    const y = await browser.evaluate(() => window.scrollY);
    const still = y === lastY;
    lastY = y;
    return still;
  }).toBe(true);
  const bar = await readJump();
  expect(bar.hashes).toEqual(['#meaning', '#questions', '#variations']);
  expect(bar.tops).toEqual([...bar.tops].sort((a, b) => a - b));
  await screen.getByRole('link', { name: /^Variantes$/ }).tap();
  await settled();
  await expect.poll(() => readJump().then(read => read.active)).toEqual(['#variations']);
  await expect.poll(() => readJump().then(read => read.covered)).toBe(true);
  const landed = await readJump();
  expect(landed.variationsTitle).toBeGreaterThanOrEqual(landed.barBottom);
  expect(landed.variationsTitle).toBeLessThan(phone.viewportHeight / 2);
  await browser.evaluate(scrollToY, Math.round(landed.faqTop - 150));
  await expect.poll(() => readJump().then(read => read.active)).toEqual(['#variations']);
  await expect.poll(() => readJump().then(read => read.covered)).toBe(true);

  // The source link of the selected scene lands on its own variation card, below the bar.
  await screen.getByRole('link', { name: /^Lire la variante/ }).tap();
  await expect.poll(() => browser.evaluate(() => window.location.hash)).toBe('#variante-cage');
  await settled();
  const target = await browser.evaluate(() => {
    const card = document.querySelector(':target');
    const title = card?.querySelector('h4')?.getBoundingClientRect();
    return { section: card?.closest('section')?.id ?? null, title: card?.querySelector('h4')?.textContent?.trim() ?? null, top: title?.top ?? -1, bar: document.querySelector('.symbol-jump-nav')!.getBoundingClientRect().bottom };
  });
  expect([target.section, target.title]).toEqual(['variations', 'Un tigre en cage ou un petit tigre']);
  expect(target.top).toBeGreaterThanOrEqual(target.bar);
  expect(target.top).toBeLessThan(phone.viewportHeight / 2);
  await app.screenshot('tiger-atlas-390-variant');

  // The other languages keep the shared single-column article.
  await app.open('/en/symbols/tiger.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await browser.evaluate(() => [document.querySelectorAll('article.atlas, .atlas-scene-input').length, document.querySelectorAll('article.max-w-3xl').length])).toEqual([0, 1]);
});
