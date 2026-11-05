import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ATLAS_SIX_PAUSE, answerAnalytics, expectReducedSurfaces, mediaPathname, readAtlasSix, readSurfaces, scrollToY, surfaceNamed } from '../site-fixtures';

test.beforeEach(answerAnalytics);

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
    objectPosition: getComputedStyle(img).objectPosition,
    viewportHeight: innerHeight,
    leadTop: document.querySelector('.symbol-summary')?.getBoundingClientRect().top ?? null,
    paintings: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname.replace(/^\/releases\/[a-f0-9]{64}(?=\/img\/)/, ''))
      .filter(path => path.startsWith('/img/seo/symbols-v2/') || /\/tiger-mobile-v4-[0-9]+w\./.test(path)),
  };
}

test('symbol artwork fills the page from behind the navbar up to 2560px', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')) as {
    symbols: Array<{ id: string; fr: { slug: string; name: string } }>;
  };
  const ids = ['sex','cheating','kissing','attack','killing','fighting','eating','kidnapping','moving-house','war','vomiting','nails','tsunami','flowers','tiger','deer','pig','monkey','lizard','bat','toilet','church','beach','castle','swimming-pool','alien','celebrity','boss','crush','witch','clown','gun','knife','wallet','doll','gold','coffin','stars','sky','god'];
  // Every listed symbol now has a complete pack. Tiger retains its dedicated historical paintings.
  const atlasIds = ids.filter(id => id !== 'tiger');
  const checkLayout = (image: Awaited<ReturnType<typeof measureHero>>) => {
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.width).toBeCloseTo(Math.min(image.available, 2560), 0);
    expect(image.left).toBeCloseTo((image.available - image.width) / 2, 0);
    expect(image.top).toBe(0);
    expect(image.heroTop).toBe(0);
    expect(image.height).toBeCloseTo(landscapeHeroHeight(image.width, image.viewportHeight), 0);
    expect([image.objectFit, image.objectPosition]).toEqual(['cover', '50% 30%']);
    expect(image.navBackground).toBe('rgba(0, 0, 0, 0)');
    expect(image.headingTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.headingBottom).toBeLessThanOrEqual(image.heroBottom);
    // The first screen shows the whole title and the first lines of the summary.
    expect(image.headingBottom).toBeLessThanOrEqual(image.viewportHeight);
    expect(image.leadTop).not.toBeNull();
    expect(image.leadTop!).toBeLessThanOrEqual(image.viewportHeight - 64);
    if (image.breadcrumbTop !== null) expect(image.breadcrumbTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.overflow).toBe(false);
  };
  await browser.setViewport({ width: 3840, height: 2160 });
  for (const id of ids) {
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    if (atlasIds.includes(id)) {
      expect(mediaPathname(image.src)).toMatch(new RegExp('^/img/symbols/atlas-six-v2/' + id + '/hero-[0-9]+-[0-9a-f]{12}\\.(?:avif|webp)$'));
    } else {
      expect(image.src).toMatch(new RegExp('/' + id + '-v1-[0-9]+w\\.(?:webp|avif)$'));
    }
    checkLayout(image);
    if (['sex', 'tiger', 'god'].includes(id)) await app.screenshot('symbol-' + id + '-wide');
  }
  // 1920 × 960 is wider than 16:9: the window where the title used to fall below the first screen.
  for (const [width, height, id] of [
    [1920, 1200, 'angel'], [1920, 960, 'tiger'], [2560, 1600, 'tiger'], [2568, 1600, 'angel'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    checkLayout(await browser.evaluate(measureHero));
    await app.screenshot('symbol-' + id + '-' + width);
  }
  // Each phone hero uses its independently composed portrait and keeps the title under the subject.
  for (const [width, height, id, position] of [
    [390, 844, 'angel', '50% 50%'], [320, 740, 'moving-house', '50% 50%'], [390, 844, 'alien', '50% 50%'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(mediaPathname(image.src)).toMatch(new RegExp('^/img/symbols/atlas-six-v2/' + id + '/portrait-[0-9]+-[0-9a-f]{12}\\.(?:webp|avif)$'));
    expect([image.objectFit, image.objectPosition]).toEqual(['cover', position]);
    expect([image.heroTop, image.top, image.left]).toEqual([0, 0, 0]);
    expect(image.width).toBeCloseTo(image.available, 0);
    expect(image.height).toBeCloseTo(height * 0.75, 0);
    expect(image.heroBottom).toBeCloseTo(height * 0.75, 0);
    expect(image.navBackground).toBe('rgba(0, 0, 0, 0)');
    expect(image.headingTop).toBeGreaterThanOrEqual(image.navBottom + 8);
    expect(image.headingBottom).toBeLessThanOrEqual(image.heroBottom);
    expect(image.overflow).toBe(false);
    await app.screenshot('symbol-' + id + '-' + width);
  }
  // The French tiger page uses its dedicated portrait painting (cover), fetched alone; the title
  // stays under the face.
  for (const [width, height] of [[390, 844], [360, 780]] as const) {
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    expect(image.src).toMatch(/\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/);
    expect(image.paintings).toEqual([mediaPathname(image.src)]);
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

// Outside a phone held upright the hero keeps the 16:9 painting's full width up to 2560px, never
// taller than the window less 10rem (the title and the start of the text open the page) nor shorter
// than 20rem.
function landscapeHeroHeight(width: number, viewportHeight: number) {
  return Math.max(320, Math.min(width * 9 / 16, viewportHeight - 160));
}

// Painted landmarks of the tiger's paintings, in source pixels: lantern centre for the glow, face
// bottom for the title.
const LANDSCAPE = { w: 1600, h: 900, lantern: [292, 163] };
const PORTRAIT = { w: 984, h: 1599, lantern: [244, 378], faceBottom: 925 };

// What a page loads of the motion engines (the packs' one, the tiger's former one) and of the tiger's
// files, and how its hero draws its painting.
function readMotionLoads() {
  const hero = document.querySelector('.symbol-hero')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const box = img.getBoundingClientRect();
  return {
    scripts: document.querySelectorAll('script[src*="symbol-living"], script[src*="tiger-living"], #symbol-living-config').length,
    requests: performance.getEntriesByType('resource').filter(entry => /\/(?:symbol|tiger)-living\/|tiger-mobile-v4/.test(entry.name)).length,
    stages: document.querySelectorAll('.slp-stage, .tlp-stage').length,
    marked: hero.hasAttribute('data-living') || hero.classList.contains('symbol-hero--living'),
    ratio: Math.round(box.width / box.height * 100) / 100,
    objectFit: getComputedStyle(img).objectFit,
    loaded: document.readyState === 'complete' && img.complete,
  };
}

test('at a phone viewport a missing motion script keeps the dedicated portrait readable', async ({ app, browser, screen }) => {
  // All 240 symbols have packs. Exercise actual degradation instead of expecting the former
  // unpacked deer. The generator's missing-pack branch remains covered by the atlas fixture.
  await browser.setViewport({ width: 390, height: 844 });
  await browser.route(/\/js\/symbol-living\/.*\.js$/, route => route.fulfill({ status: 404, body: '' }));
  for (const path of ['/fr/symboles/cerf.html', '/en/symbols/deer.html', '/pt-br/simbolos/cervo.html']) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readMotionLoads).then(read => read.loaded)).toBe(true);
    const image = await browser.evaluate(measureHero);
    expect(image.src).toContain('/deer/portrait-');
    expect(image.objectFit).toBe('cover');
    expect(image.height).toBeCloseTo(844 * 0.75, 0);
    expect(image.headingBottom).toBeLessThanOrEqual(image.heroBottom);
    expect(image.overflow).toBe(false);
    expect((await browser.evaluate(readMotionLoads)).stages).toBe(0);
    expect(await browser.evaluate(() => document.querySelectorAll('.atlas-scene-input').length)).toBe(3);
    await app.screenshot('deer-portrait-without-motion-' + path.split('/')[1]);
  }
});

// Atlas composition of the same page, read like a dictionary entry: the index beside
// the opening plate only, the meaning beside the tiger art, the app, then the three scene
// cards with the chosen scene's reading on their right (under them on a phone), and the
// rest across the whole frame, the app again last. The native scene selector must show, beside
// the list, the opening question and the next sentence of the matching published
// variation card.
function readAtlas() {
  const rect = (selector: string) => {
    const node = document.querySelector(selector);
    if (!node || getComputedStyle(node).display === 'none') return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width };
  };
  const flat = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, '');
  const visible = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result')).filter(node => getComputedStyle(node).display !== 'none');
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  const label = checked ? document.querySelector(`label[for="${checked.id}"] .atlas-scene-variation`)?.textContent?.trim() ?? null : null;
  const card = Array.from(document.querySelectorAll('#variations .variation-card')).find(node => node.querySelector('h3')?.textContent?.trim() === label);
  const words = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();
  return {
    viewport: document.documentElement.clientWidth,
    viewportHeight: window.innerHeight,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    article: rect('article.atlas'), rail: rect('.atlas-rail'), reading: rect('.atlas-reading'), scenes: rect('.atlas-scenes'),
    decor: rect('.atlas-decor'), list: rect('.atlas-scene-list'), reflection: rect('#reflexion'), questionsBox: rect('#questions'), relatedBox: rect('#associes'),
    questionTops: Array.from(document.querySelectorAll('#questions .symbol-question-item')).map(node => Math.round(node.getBoundingClientRect().top)),
    checked: checked?.value ?? null,
    checkedLabel: checked ? document.querySelector(`label[for="${checked.id}"] .atlas-scene-label`)?.textContent?.trim() ?? null : null,
    shown: visible.map(node => ({
      scene: node.dataset.scene ?? '',
      inReading: Boolean(node.closest('#reflexion')),
      chosen: node.querySelector('.atlas-scene-chosen')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      question: node.querySelector('.atlas-scene-question')!.textContent!.trim(),
      excerpt: node.querySelector('.atlas-scene-excerpt')!.textContent!.trim(),
    })),
    card: card ? card.querySelector('p')!.textContent!.replace(/[ \t\r\n]+/g, ' ').trim() : null, // keeps French non-breaking spaces
    zones: { meaning: flat(document.querySelector('#meaning')), lecture: flat(document.querySelector('#lecture')) },
    headings: Array.from(document.querySelectorAll('article.atlas :is(h2, h3, h4)')).map(node => Number(node.tagName.slice(1))),
    sections: Array.from(document.querySelectorAll('article.atlas h2')).map(words),
    index: Array.from(document.querySelectorAll('.atlas-rail a')).map(words),
    // The hero title is the name alone, without a "Signification :" label.
    title: words(document.querySelector('h1')!),
    ids: ['meaning', 'continuer-noctalia', 'scenes', 'reflexion', 'questions', 'lecture', 'variations', 'faq', 'plus-loin', 'associes', 'garder-noctalia'].filter(id => document.getElementById(id)),
    railTargets: Array.from(document.querySelectorAll<HTMLAnchorElement>('.atlas-rail a')).map(link => Boolean(document.getElementById(link.hash.slice(1)))),
    counts: {
      opening: document.querySelectorAll('#meaning .prose > p').length,
      continuation: document.querySelectorAll('#lecture .prose > p').length,
      variations: document.querySelectorAll('#variations .variation-card').length,
      questions: document.querySelectorAll('#questions .symbol-question-item').length,
      faq: document.querySelectorAll('#faq .symbol-faq-card').length,
    },
    related: Array.from(document.querySelectorAll<HTMLAnchorElement>('#associes a.symbol-link')).map(link => link.getAttribute('href')),
    decorLoads: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/atlas-tiger-v1/tiger-atlas-vignette')).length,
  };
}

type Atlas = Awaited<ReturnType<typeof readAtlas>>;

// The reading beside the list names the selected card and shows its opening question and the sentence after it.
const expectPublishedScene = (atlas: Atlas, scene: string) => {
  expect(atlas.checked).toBe(scene);
  expect(atlas.shown.map(shown => [shown.scene, shown.inReading])).toEqual([[scene, true]]);
  const [{ question, excerpt, chosen }] = atlas.shown;
  expect(chosen).toBe(`Votre scène : ${atlas.checkedLabel}`);
  expect(question.endsWith('?')).toBe(true);
  expect(atlas.card!.startsWith(question)).toBe(true);
  expect(atlas.card!.slice(question.length).trim().startsWith(excerpt)).toBe(true);
};

// The selected illustration is the thumbnail's own painting, served at a larger
// responsive size. Read the displayed result rather than hidden sibling images.
async function readExpandedScene() {
  const results = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result'))
    .filter(node => getComputedStyle(node).display !== 'none');
  const result = results[0];
  const img = result?.querySelector<HTMLImageElement>('.atlas-scene-art img');
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  const thumb = checked ? document.querySelector<HTMLImageElement>(`label[for="${checked.id}"] .atlas-scene-thumb img`) : null;
  if (!img || !thumb) return null;
  // A broken asset is reported by the assertions, without hiding the selected text.
  await Promise.all([img.decode().catch(() => {}), thumb.decode().catch(() => {})]);
  const box = img.getBoundingClientRect();
  const thumbBox = thumb.getBoundingClientRect();
  const readingBox = result.querySelector('.atlas-scene-reading')!.getBoundingClientRect();
  const cover = Math.max(0, ...['#navbar', '.symbol-jump-nav'].map(selector => {
    const node = document.querySelector(selector);
    return node && getComputedStyle(node).display !== 'none' ? node.getBoundingClientRect().bottom : 0;
  }));
  const family = (source: string) => new URL(source).pathname.replace(/-\d+-[0-9a-f]{12}\.(?:avif|webp)$/, '');
  return {
    visibleResults: results.length,
    scene: result.dataset.scene ?? null,
    checked: checked?.value ?? null,
    family: img.currentSrc ? family(img.currentSrc) : null,
    thumbFamily: thumb.currentSrc ? family(thumb.currentSrc) : null,
    naturalWidth: img.naturalWidth,
    sizes: img.sizes,
    thumbSizes: thumb.sizes,
    width: box.width, height: box.height, thumbWidth: thumbBox.width,
    imageBeforeReading: box.bottom <= readingBox.top + 1 || box.right <= readingBox.left + 1,
    inView: box.top >= cover - 1 && box.top < innerHeight / 2 && box.bottom > cover,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}

async function expectExpandedScene(browser: Browser, scene: string) {
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.naturalWidth ?? 0)).toBeGreaterThan(0);
  const art = (await browser.evaluate(readExpandedScene))!;
  expect([art.visibleResults, art.scene, art.checked]).toEqual([1, scene, scene]);
  expect(art.family).toBe(art.thumbFamily);
  expect(art.sizes).not.toBe(art.thumbSizes);
  expect(art.width).toBeGreaterThan(art.thumbWidth * 2);
  expect(art.width / art.height).toBeCloseTo(16 / 9, 2);
  expect([art.imageBeforeReading, art.overflow]).toEqual([true, false]);
}

test('the French tiger atlas reads like a dictionary entry and shows each published scene from mouse or keyboard', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  // Every paragraph of the published interpretation, whole, in its zone: the first opens the plate,
  // the others make the detailed reading.
  const extended = JSON.parse(readFileSync(new URL('../../../data/dream-symbols-extended.json', import.meta.url), 'utf8')) as {
    symbols: Record<string, { fr: { fullInterpretation: string } }>;
  };
  const source = (extended.symbols.tiger.fr.fullInterpretation.match(/<p>[\s\S]*?<\/p>/g) ?? [])
    .map(paragraph => paragraph.replace(/<[^>]+>/g, '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ''));
  expect(source).toHaveLength(4);

  for (const [width, height] of [[1586, 992], [1920, 1080]] as const) {
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/tigre.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const wide = await browser.evaluate(readAtlas);
    // About 90 % of the width; rail | reading | art in the opening, the art never behind the reading.
    expect(wide.article!.width).toBeGreaterThanOrEqual(wide.viewport * 0.88);
    expect(wide.rail!.right).toBeLessThanOrEqual(wide.reading!.left);
    expect(wide.decor!.left).toBeGreaterThanOrEqual(wide.reading!.right);
    expect(wide.decor!.width).toBeGreaterThanOrEqual(500);
    // Then the scene list with the chosen scene's reading on its right, on the same line.
    expect(wide.scenes!.top).toBeGreaterThanOrEqual(Math.max(wide.reading!.bottom, wide.decor!.bottom));
    expect(wide.reflection!.left).toBeGreaterThanOrEqual(wide.list!.right);
    expect(wide.reflection!.top).toBeLessThan(wide.list!.bottom);
    // The questions and the rest span the whole frame, under the index; the questions on one line.
    expect(wide.rail!.bottom).toBeLessThanOrEqual(wide.questionsBox!.top);
    expect(wide.questionsBox!.left).toBeCloseTo(wide.article!.left, 0);
    expect(wide.questionsBox!.right).toBeCloseTo(wide.article!.right, 0);
    expect(wide.relatedBox!.left).toBeCloseTo(wide.article!.left, 0);
    expect(new Set(wide.questionTops).size).toBe(1);
    expect(wide.overflow).toBe(false);
    await app.screenshot('tiger-atlas-' + width);
  }

  const wide = await browser.evaluate(readAtlas);
  // Every published block, anchor and link survives in page order, the app right after the meaning
  // and again last, under one h2 per section; the index lists the section titles.
  expect(wide.ids).toEqual(['meaning', 'continuer-noctalia', 'scenes', 'reflexion', 'questions', 'lecture', 'variations', 'faq', 'plus-loin', 'associes', 'garder-noctalia']);
  expect(wide.railTargets.every(Boolean)).toBe(true);
  expect(wide.counts).toEqual({ opening: 1, continuation: 3, variations: 6, questions: 3, faq: 4 });
  source.forEach((paragraph, index) => {
    const zone = index === 0 ? 'meaning' : 'lecture';
    expect(wide.zones[zone].includes(paragraph), `interpretation paragraph ${index + 1} is whole in #${zone}`).toBe(true);
  });
  const sections = ['Que signifie-t-il ?', 'Scènes courantes', 'Questions à se poser', 'Lecture détaillée', 'Variations courantes', 'FAQ', 'Pour aller plus loin'];
  const appTitle = 'Analysez votre propre rêve dans Noctalia';
  expect(wide.sections).toEqual([sections[0], appTitle, ...sections.slice(1), appTitle]);
  expect(wide.index).toEqual(sections);
  expect(wide.title).toBe('Tigre');
  expect(wide.headings[0]).toBe(2);
  wide.headings.forEach((level, index) => { if (index) expect(level).toBeLessThanOrEqual(wide.headings[index - 1] + 1); });
  expect(wide.related).toEqual(['/fr/symboles/lion', '/fr/symboles/chat', '/fr/symboles/poursuite', '/fr/symboles/loup']);
  expectPublishedScene(wide, 'poursuite');

  // Mouse on the visible cards, then the arrow keys of the native radio group, back round to the first.
  // A clicked card brings the enlarged painting into view. Its reading follows
  // the image and can be taller than the viewport without hiding the illustration.
  await screen.getByText('Il est calme').tap(); // the native radio is visually hidden behind its card
  await expect(screen.getByRole('radio', { name: /^Il est calme/ })).toBeChecked();
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.inView)).toBe(true);
  expectPublishedScene(await browser.evaluate(readAtlas), 'calme');
  await expectExpandedScene(browser, 'calme');
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'scene-calme-expanded').state)).toBe('running');
  const movingArt = surfaceNamed(await browser.evaluate(readSurfaces), 'scene-calme-expanded');
  expect(movingArt.channels).toEqual(['a', 'b']);
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'scene-calme-expanded').frames.map((frame, index) => frame !== movingArt.frames[index]))).toEqual([true, true]);
  await app.screenshot('tiger-expanded-calm-1920');
  await screen.getByRole('radio', { name: /^Il est calme/ }).press('ArrowDown');
  await expect(screen.getByRole('radio', { name: /^Il est en cage/ })).toBeChecked();
  expectPublishedScene(await browser.evaluate(readAtlas), 'cage');
  await expectExpandedScene(browser, 'cage');
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'scene-calme-expanded').state)).toBe('paused');
  await screen.getByRole('radio', { name: /^Il est en cage/ }).press('ArrowDown');
  await expect(screen.getByRole('radio', { name: /^Il me poursuit/ })).toBeChecked();
  expectPublishedScene(await browser.evaluate(readAtlas), 'poursuite');
  await expectExpandedScene(browser, 'poursuite');

  // At an intermediate width the illustration keeps a useful width below the
  // choices; a premature two-column layout would squeeze the same painting.
  await browser.setViewport({ width: 900, height: 1000 });
  await app.open('/fr/symboles/tigre.html');
  await screen.getByText('Il est calme').tap();
  await expect(screen.getByRole('radio', { name: /^Il est calme/ })).toBeChecked();
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.inView)).toBe(true);
  const tablet = await browser.evaluate(readAtlas);
  expect(tablet.reflection!.top).toBeGreaterThanOrEqual(tablet.list!.bottom);
  expect(tablet.reflection!.left).toBeCloseTo(tablet.list!.left, 0);
  expectPublishedScene(tablet, 'calme');
  await expectExpandedScene(browser, 'calme');
  await app.screenshot('tiger-expanded-calm-900');

  // A phone: one column without overflow, the choices right after the opening, the chosen
  // scene's reading right under them and the questions after it, and the hidden art never fetched.
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/fr/symboles/tigre.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await screen.getByText('Il est en cage').tap();
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.inView)).toBe(true);
  const phone = await browser.evaluate(readAtlas);
  expect(phone.overflow).toBe(false);
  expect([phone.rail, phone.decor, phone.decorLoads]).toEqual([null, null, 0]);
  expect(phone.scenes!.top).toBeGreaterThanOrEqual(phone.reading!.bottom);
  expect(phone.scenes!.top - phone.article!.top).toBeLessThan(2 * phone.viewportHeight);
  expect(phone.reflection!.top).toBeGreaterThanOrEqual(phone.list!.bottom);
  expect(phone.reflection!.left).toBeCloseTo(phone.list!.left, 0);
  expect(phone.questionsBox!.top).toBeGreaterThanOrEqual(phone.reflection!.bottom);
  expectPublishedScene(phone, 'cage');
  await expectExpandedScene(browser, 'cage');
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'scene-cage-expanded').state)).toBe('reduced');
  expect((await browser.evaluate(readAtlasSix)).playStates).toEqual([]);
  await app.screenshot('tiger-atlas-390');
  await browser.emulateMedia({ reducedMotion: 'no-preference' });
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
      covered: bar.top <= Math.max(0, document.querySelector('#navbar')!.getBoundingClientRect().bottom) + 1,
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
    const title = card?.querySelector('h3')?.getBoundingClientRect();
    return { section: card?.closest('section')?.id ?? null, title: card?.querySelector('h3')?.textContent?.trim() ?? null, top: title?.top ?? -1, bar: document.querySelector('.symbol-jump-nav')!.getBoundingClientRect().bottom };
  });
  expect([target.section, target.title]).toEqual(['variations', 'Un tigre en cage ou un petit tigre']);
  expect(target.top).toBeGreaterThanOrEqual(target.bar);
  expect(target.top).toBeLessThan(phone.viewportHeight / 2);
  await app.screenshot('tiger-atlas-390-variant');

  // Deer now has its complete pack too: its own content stays in the article,
  // with the three scenes, side painting and common engine after the 240-pack rollout.
  await app.open('/fr/symboles/cerf.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await browser.evaluate(() => ({
    articles: document.querySelectorAll('article.atlas').length,
    packParts: document.querySelectorAll('.atlas-scene-input, .atlas-decor, article.max-w-3xl, script[src*="symbol-living"], #symbol-living-config').length,
    ids: Array.from(document.querySelectorAll('article.atlas :is(section, aside)[id]')).map(node => node.id),
    jumps: Array.from(document.querySelectorAll('.symbol-jump-link')).map(link => link.textContent!.trim()),
  }))).toEqual({
    articles: 1, packParts: 6,
    ids: ['meaning', 'continuer-noctalia', 'scenes', 'reflexion', 'questions', 'lecture', 'variations', 'faq', 'plus-loin', 'garder-noctalia'],
    jumps: ['Sens', 'Questions', 'Variantes'],
  });
  await app.screenshot('symbol-cerf-390');
});

// The tiger's paintings move on the packs' engine, with its own files (owner request 2026-10-20): on its
// hero, side illustration and three thumbnails the lantern glow (channel a) breathes and the mist
// (channel b) drifts, in each of its six languages.
const TIGER_PAGES = ['/fr/symboles/tigre.html', '/en/symbols/tiger.html', '/es/simbolos/tigre.html', '/de/traumsymbole/tiger.html', '/it/simboli/tigre.html', '/pt-br/simbolos/tigre.html'];
const TIGER_SCENES = ['poursuite', 'calme', 'cage'];

// The engine's one script, served from a folder named after its hash, as the tiger pages name it.
function symbolLivingScript() {
  const html = readFileSync(new URL('../../../docs/fr/symboles/tigre.html', import.meta.url), 'utf8');
  const src = html.match(/<script src="(\/js\/symbol-living\/[0-9a-f]{12}\/symbol-living\.js)" defer><\/script>/)?.[1];
  expect(src, 'The French tiger page loads the versioned common engine').toBeDefined();
  const served = readFileSync(new URL('../../../docs' + src, import.meta.url));
  expect(src!.split('/')[3]).toBe(createHash('sha256').update(served).digest('hex').slice(0, 12));
  return src!;
}

// The hero's painted frame (object-fit contain or cover, object-position in %), the stage of its
// effects and the centre of its glow.
function readTigerHero() {
  const hero = document.querySelector<HTMLElement>('.symbol-hero')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const box = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  // While the browser swaps sources the new image has no size yet: fall back to the box.
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : box.width / box.height;
  const wide = box.width / box.height > ratio;
  const fitWidth = cs.objectFit === 'cover' ? wide : !wide;
  const width = fitWidth ? box.width : box.height * ratio;
  const height = fitWidth ? box.width / ratio : box.height;
  const [px, py] = cs.objectPosition.split(' ').map(parseFloat);
  const scene = Array.from(hero.querySelectorAll('.slp-scene')).find(node => getComputedStyle(node).display !== 'none');
  const glow = scene?.querySelector('.slp-l[data-living-channel="a"]')?.getBoundingClientRect();
  const stage = hero.querySelector('.slp-stage')?.getBoundingClientRect();
  const heroBox = hero.getBoundingClientRect();
  return {
    scene: hero.dataset.livingScene ?? null,
    src: img.currentSrc,
    hero: { width: heroBox.width, height: heroBox.height },
    frame: { left: box.left + (box.width - width) * px / 100, top: box.top + (box.height - height) * py / 100, width, height },
    stage: stage ? { left: stage.left, top: stage.top, width: stage.width, height: stage.height } : null,
    glow: glow ? [glow.left + glow.width / 2, glow.top + glow.height / 2] : null,
  };
}

// The effects sit on the painted frame and the glow on the lantern, within a pixel.
const expectOnLantern = (read: Awaited<ReturnType<typeof readTigerHero>>) => {
  const painting = read.scene === 'portrait' ? PORTRAIT : LANDSCAPE;
  for (const key of ['left', 'top', 'width', 'height'] as const) expect(Math.abs(read.stage![key] - read.frame[key]), key).toBeLessThan(1);
  expect(Math.abs(read.glow![0] - (read.frame.left + painting.lantern[0] / painting.w * read.frame.width)), 'glow x').toBeLessThan(1);
  expect(Math.abs(read.glow![1] - (read.frame.top + painting.lantern[1] / painting.h * read.frame.height)), 'glow y').toBeLessThan(1);
};

test('the tiger paintings each move two effects of the packs\' engine in the six languages, only on screen, and stop by themselves off screen or with reduced motion, without a pause control', { timeout: 300_000 }, async ({ app, browser, screen }) => {
  const engine = symbolLivingScript();
  await browser.setViewport({ width: 1920, height: 1080 });
  for (const path of TIGER_PAGES) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    // The previous page ends in reduced motion: the live preference returns to none once this page is open.
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    // One engine, the packs' own; the tiger's former script is no longer loaded.
    expect(await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="-living"]')).map(node => new URL(node.src).pathname)), path).toEqual([engine]);
    const config = await browser.evaluate(readAtlasSix).then(read => read.config);
    expect(config?.surfaces.map(surface => surface.name).sort(), path)
      .toEqual(['hero', 'plate', ...TIGER_SCENES.flatMap(scene => ['scene-' + scene, 'scene-' + scene + '-expanded'])].sort());
    // On every painting, channel a is the tiger's lantern glow and channel b its mist, from its own folder.
    for (const surface of config!.surfaces) {
      for (const [scene, { layers }] of Object.entries(surface.scenes)) {
        expect(layers.map(layer => [layer.channel, layer.src.replace(/^\/js\/tiger-living\/[0-9a-f]{12}\/assets\//, '')]), `${path} ${surface.name} ${scene}`)
          .toEqual([['a', 'lantern-glow.webp'], ['b', 'mist-mobile.webp']]);
      }
    }

    // A painting on screen runs both effects: two channels, two different decoded textures with
    // visible pixels, each actually changing.
    const expectLiving = async (name: string) => {
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, name).living, surfaceNamed(all, name).state]), { timeout: 15_000 }).toEqual(['ready', 'running']);
      const first = surfaceNamed(await browser.evaluate(readSurfaces), name);
      expect(first.channels, `${path} ${name}`).toEqual(['a', 'b']);
      expect(first.textures[0]).not.toBe(first.textures[1]);
      expect(first.opaque.every(count => count > 0), `${path} ${name}: both textures have visible pixels`).toBe(true);
      expect(first.stretch.every(gap => gap < 0.01), `${path} ${name}: both textures keep their ratio`).toBe(true);
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, name).frames.map((frame, index) => frame !== first.frames[index]))).toEqual([true, true]);
    };

    await expectLiving('hero');
    const hero = await browser.evaluate(readAtlasSix);
    expect([hero.scene, hero.src.includes(config!.surfaces[0].scenes.landscape.match)]).toEqual(['landscape', true]);
    expect(hero.properties.every(property => property === 'opacity' || property === 'transform')).toBe(true);
    expect([hero.paintingAnimations, hero.figureShift]).toEqual([0, 0]);
    expectOnLantern(await browser.evaluate(readTigerHero));
    // Depth: the painting and its effects follow half the scroll together, never zoomed.
    const down = 300;
    expect(await browser.evaluate(scrollToY, down)).toBe(down);
    await expect.poll(() => browser.evaluate(readAtlasSix).then(read => Math.abs(read.figureShift - down * config!.surfaces[0].depth!) <= 0.5)).toBe(true);
    expect(config!.surfaces[0].depth).toBe(0.5);
    expectOnLantern(await browser.evaluate(readTigerHero));

    // The side illustration beside the meaning, then the thumbnails: each runs on its own while the
    // hero, scrolled away, rests.
    await browser.evaluate(() => { document.querySelector('[data-living-surface="plate"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    await expectLiving('plate');
    await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    for (const scene of TIGER_SCENES) await expectLiving('scene-' + scene);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').state, surfaceNamed(all, 'hero').reasons])).toEqual(['paused', ['offscreen']]);
    expect((await browser.evaluate(readAtlasSix)).thumbsClear).toEqual([true, true, true]);
    await app.screenshot('tiger-scenes-1920-' + path.split('/')[1]);

    // No pause control (owner decision) on any painting or group of paintings.
    expect(await browser.evaluate(() => document.querySelectorAll('.symbol-hero button, [data-living-surface] button, .atlas-scenes button, .slp-toggle').length)).toBe(0);
    expect(await screen.getByRole('button', { name: ATLAS_SIX_PAUSE }).count()).toBe(0);
    // Back at the top the hero runs again, and the thumbnails, now off screen, stop.
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').state, ...TIGER_SCENES.map(scene => surfaceNamed(all, 'scene-' + scene).reasons.join(' '))]))
      .toEqual(['running', 'offscreen', 'offscreen', 'offscreen']);

    // A live reduced-motion preference stops every painting; back to none, the hero on screen runs again.
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await expectReducedSurfaces(browser);
    expect((await browser.evaluate(readAtlasSix)).playStates).toEqual([]);
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').state)).toBe('running');
  }
});

test('on a phone the tiger hero takes 75svh with its portrait painting in the six languages, its effects on the lantern of the painting shown as the phone turns', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  for (const path of TIGER_PAGES) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').living, surfaceNamed(all, 'hero').state]), { timeout: 15_000 }).toEqual(['ready', 'running']);
    const read = await browser.evaluate(readTigerHero);
    expect([read.scene, /\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/.test(read.src)], path).toEqual(['portrait', true]);
    expect(read.hero.height).toBeCloseTo(844 * 0.75, 0);
    expectOnLantern(read);
    const first = surfaceNamed(await browser.evaluate(readSurfaces), 'hero');
    expect(first.channels, path).toEqual(['a', 'b']);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').frames.map((frame, index) => frame !== first.frames[index]))).toEqual([true, true]);
  }
  // Turning the phone, then back: the effects follow the painting the browser shows.
  for (const [width, height, scene, painting] of [
    [700, 390, 'landscape', /\/tiger-v1-[0-9]+w\.(?:webp|avif)$/], // narrow but held sideways
    [1280, 720, 'landscape', /\/tiger-v1-[0-9]+w\.(?:webp|avif)$/],
    [390, 844, 'portrait', /\/tiger-mobile-v4-[0-9]+w\.(?:webp|avif)$/],
  ] as const) {
    await browser.setViewport({ width, height });
    await expect.poll(() => browser.evaluate(readTigerHero).then(read => [read.scene, painting.test(read.src)]), { timeout: 15_000 }).toEqual([scene, true]);
    await expect.poll(() => browser.evaluate(readTigerHero).then(read => Math.abs(read.stage!.width - read.frame.width) < 0.5)).toBe(true);
    const read = await browser.evaluate(readTigerHero);
    // Landscape caps the full-width hero to the window; portrait takes 75svh. Both crop with cover.
    if (scene === 'landscape') expect(read.hero.height).toBeCloseTo(landscapeHeroHeight(read.hero.width, height), 0);
    else expect(read.hero.height).toBeCloseTo(height * 0.75, 0);
    expectOnLantern(read);
  }
});

test('a broken texture or reduced motion from the first load keeps the tiger paintings still', async ({ app, browser }) => {
  // The tiger's textures come from its V4 folder.
  const glow = '**/js/tiger-living/*/assets/lantern-glow.webp';
  await browser.setViewport({ width: 1920, height: 1080 });
  await browser.route(glow, route => route.fulfill({ status: 404, body: '' }));
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').living), { timeout: 15_000 }).toBe('off');
  const broken = await browser.evaluate(readAtlasSix);
  expect(broken.src).toMatch(/\/tiger-v1-[0-9]+w\.(?:webp|avif)$/);
  expect([broken.paintingAnimations, broken.playStates, await browser.evaluate(() => document.querySelectorAll('.symbol-hero .slp-stage').length)]).toEqual([0, [], 0]);
  expect(await browser.evaluate(scrollToY, 300)).toBe(300);
  await expect.poll(() => browser.evaluate(readAtlasSix).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
  expect(await browser.evaluate(scrollToY, 0)).toBe(0);

  await browser.unroute(glow);
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await app.open('/fr/symboles/tigre.html');
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').living, surfaceNamed(all, 'hero').state]), { timeout: 15_000 }).toEqual(['ready', 'reduced']);
  expect((await browser.evaluate(readAtlasSix)).playStates).toEqual([]);
  expect(await browser.evaluate(scrollToY, 300)).toBe(300);
  await expect.poll(() => browser.evaluate(readAtlasSix).then(read => read.figureShift), { timeout: 1_500 }).not.toBeGreaterThan(0);
});

// The thirty-seven atlas pages (the tiger and the thirty-six after it) in each published language: the
// same paintings, engine and layout as in French, every word from the page's own language. The list
// is literal. A language whose catalog has no FAQ for a symbol shows no FAQ section (twenty-four pt-br symbols, two Italian).
const ATLAS_LANGUAGES = [
  {
    tag: 'en', chosen: 'Your scene: ', source: 'Read the variation “',
    sections: ['What Does It Mean?', 'Common scenes', 'Questions to Ask Yourself', 'Detailed reading', 'Common Variations', 'FAQ', 'Learn More'],
    ids: ['meaning', 'continue-in-noctalia', 'scenes', 'reflection', 'questions', 'reading', 'variations', 'faq', 'further', 'related', 'keep-in-noctalia'],
    pages: [['/en/symbols/tiger', 'Tiger'], ['/en/symbols/snake', 'Snake'], ['/en/symbols/ocean', 'Ocean / Sea'], ['/en/symbols/forest', 'Forest'], ['/en/symbols/house', 'House'], ['/en/symbols/falling', 'Falling'], ['/en/symbols/butterfly', 'Butterfly'], ['/en/symbols/moon', 'Moon'], ['/en/symbols/door', 'Door'], ['/en/symbols/fire', 'Fire'], ['/en/symbols/bird', 'Bird'], ['/en/symbols/train', 'Train'], ['/en/symbols/clock', 'Clock'], ['/en/symbols/water', 'Water'], ['/en/symbols/dog', 'Dog'], ['/en/symbols/teeth', 'Teeth (losing teeth)'], ['/en/symbols/flying', 'Flying'], ['/en/symbols/car', 'Car'], ['/en/symbols/bridge', 'Bridge'], ['/en/symbols/cat', 'Cat'], ['/en/symbols/mountain', 'Mountain'], ['/en/symbols/key', 'Key'], ['/en/symbols/rain', 'Rain'], ['/en/symbols/stairs', 'Stairs'], ['/en/symbols/mirror', 'Mirror'], ['/en/symbols/horse', 'Horse'], ['/en/symbols/castle', 'Castle'], ['/en/symbols/stars', 'Stars'], ['/en/symbols/flowers', 'Flowers'], ['/en/symbols/baby', 'Baby'], ['/en/symbols/storm', 'Storm'], ['/en/symbols/wolf', 'Wolf'], ['/en/symbols/elevator', 'Elevator'], ['/en/symbols/candle', 'Candle'], ['/en/symbols/book', 'Book'], ['/en/symbols/snow', 'Snow'], ['/en/symbols/desert', 'Desert']],
    withoutFaq: [],
  },
  {
    tag: 'fr', chosen: 'Votre scène : ', source: 'Lire la variante « ',
    sections: ['Que signifie-t-il ?', 'Scènes courantes', 'Questions à se poser', 'Lecture détaillée', 'Variations courantes', 'FAQ', 'Pour aller plus loin'],
    ids: ['meaning', 'continuer-noctalia', 'scenes', 'reflexion', 'questions', 'lecture', 'variations', 'faq', 'plus-loin', 'associes', 'garder-noctalia'],
    pages: [['/fr/symboles/tigre', 'Tigre'], ['/fr/symboles/serpent', 'Serpent'], ['/fr/symboles/mer', 'Mer / Océan'], ['/fr/symboles/foret', 'Forêt'], ['/fr/symboles/maison', 'Maison'], ['/fr/symboles/chute', 'Chute'], ['/fr/symboles/papillon', 'Papillon'], ['/fr/symboles/lune', 'Lune'], ['/fr/symboles/porte', 'Porte'], ['/fr/symboles/feu', 'Feu'], ['/fr/symboles/oiseau', 'Oiseau'], ['/fr/symboles/train', 'Train'], ['/fr/symboles/horloge', 'Horloge'], ['/fr/symboles/eau', 'Eau'], ['/fr/symboles/chien', 'Chien'], ['/fr/symboles/dents', 'Dents (perdre ses dents)'], ['/fr/symboles/voler', 'Voler'], ['/fr/symboles/voiture', 'Voiture'], ['/fr/symboles/pont', 'Pont'], ['/fr/symboles/chat', 'Chat'], ['/fr/symboles/montagne', 'Montagne'], ['/fr/symboles/cle', 'Clé'], ['/fr/symboles/pluie', 'Pluie'], ['/fr/symboles/escalier', 'Escalier'], ['/fr/symboles/miroir', 'Miroir'], ['/fr/symboles/cheval', 'Cheval'], ['/fr/symboles/chateau', 'Château'], ['/fr/symboles/etoiles', 'Étoiles'], ['/fr/symboles/fleurs', 'Fleurs'], ['/fr/symboles/bebe', 'Bébé'], ['/fr/symboles/orage', 'Orage'], ['/fr/symboles/loup', 'Loup'], ['/fr/symboles/ascenseur', 'Ascenseur'], ['/fr/symboles/bougie', 'Bougie'], ['/fr/symboles/livre', 'Livre'], ['/fr/symboles/neige', 'Neige'], ['/fr/symboles/desert', 'Désert']],
    withoutFaq: [],
  },
  {
    tag: 'es', chosen: 'Tu escena: ', source: 'Leer la variante «',
    sections: ['¿Qué significa?', 'Escenas frecuentes', 'Preguntas para reflexionar', 'Lectura detallada', 'Variaciones comunes', 'Preguntas frecuentes', 'Saber más'],
    ids: ['meaning', 'continuar-en-noctalia', 'scenes', 'reflexion', 'questions', 'lectura', 'variations', 'faq', 'para-saber-mas', 'relacionados', 'guardar-en-noctalia'],
    pages: [['/es/simbolos/tigre', 'Tigre'], ['/es/simbolos/serpiente', 'Serpiente'], ['/es/simbolos/oceano', 'Océano / Mar'], ['/es/simbolos/bosque', 'Bosque'], ['/es/simbolos/casa', 'Casa'], ['/es/simbolos/caida', 'Caída'], ['/es/simbolos/mariposa', 'Mariposa'], ['/es/simbolos/luna', 'Luna'], ['/es/simbolos/puerta', 'Puerta'], ['/es/simbolos/fuego', 'Fuego'], ['/es/simbolos/pajaro', 'Pájaro'], ['/es/simbolos/tren', 'Tren'], ['/es/simbolos/reloj-de-pared', 'Reloj de pared'], ['/es/simbolos/agua', 'Agua'], ['/es/simbolos/perro', 'Perro'], ['/es/simbolos/dientes', 'Dientes (perder dientes)'], ['/es/simbolos/volar', 'Volar'], ['/es/simbolos/coche', 'Coche'], ['/es/simbolos/puente', 'Puente'], ['/es/simbolos/gato', 'Gato'], ['/es/simbolos/montana', 'Montaña'], ['/es/simbolos/llave', 'Llave'], ['/es/simbolos/lluvia', 'Lluvia'], ['/es/simbolos/escaleras', 'Escaleras'], ['/es/simbolos/espejo', 'Espejo'], ['/es/simbolos/caballo', 'Caballo'], ['/es/simbolos/castillo', 'Castillo'], ['/es/simbolos/estrellas', 'Estrellas'], ['/es/simbolos/flores', 'Flores'], ['/es/simbolos/bebe', 'Bebé'], ['/es/simbolos/tormenta', 'Tormenta'], ['/es/simbolos/lobo', 'Lobo'], ['/es/simbolos/ascensor', 'Ascensor'], ['/es/simbolos/vela', 'Vela'], ['/es/simbolos/libro', 'Libro'], ['/es/simbolos/nieve', 'Nieve'], ['/es/simbolos/desierto', 'Desierto']],
    withoutFaq: [],
  },
  {
    tag: 'de', chosen: 'Deine Szene: ', source: 'Variante lesen „',
    sections: ['Was bedeutet es?', 'Häufige Szenen', 'Fragen zur Selbstreflexion', 'Ausführliche Deutung', 'Häufige Variationen', 'Häufige Fragen', 'Mehr erfahren'],
    ids: ['meaning', 'weiter-in-noctalia', 'scenes', 'reflexion', 'questions', 'deutung', 'variations', 'faq', 'weiterlesen', 'verwandt', 'behalten-in-noctalia'],
    pages: [['/de/traumsymbole/tiger', 'Tiger'], ['/de/traumsymbole/schlange', 'Schlange'], ['/de/traumsymbole/meer', 'Meer / Ozean'], ['/de/traumsymbole/wald', 'Wald'], ['/de/traumsymbole/haus', 'Haus'], ['/de/traumsymbole/fallen', 'Fallen im Traum'], ['/de/traumsymbole/schmetterling', 'Schmetterling'], ['/de/traumsymbole/mond', 'Mond'], ['/de/traumsymbole/tuer', 'Tür'], ['/de/traumsymbole/feuer', 'Feuer'], ['/de/traumsymbole/vogel', 'Vogel'], ['/de/traumsymbole/zug', 'Zug'], ['/de/traumsymbole/wanduhr', 'Wanduhr'], ['/de/traumsymbole/wasser', 'Wasser'], ['/de/traumsymbole/hund', 'Hund'], ['/de/traumsymbole/zaehne', 'Zähne fallen aus'], ['/de/traumsymbole/fliegen', 'Fliegen'], ['/de/traumsymbole/auto', 'Auto'], ['/de/traumsymbole/bruecke', 'Brücke'], ['/de/traumsymbole/katze', 'Katze'], ['/de/traumsymbole/berg', 'Berg'], ['/de/traumsymbole/schluessel', 'Schlüssel'], ['/de/traumsymbole/regen', 'Regen'], ['/de/traumsymbole/treppe', 'Treppe'], ['/de/traumsymbole/spiegel', 'Spiegel'], ['/de/traumsymbole/pferd', 'Pferd'], ['/de/traumsymbole/schloss', 'Schloss / Burg'], ['/de/traumsymbole/sterne', 'Sterne'], ['/de/traumsymbole/blumen', 'Blumen'], ['/de/traumsymbole/baby', 'Baby'], ['/de/traumsymbole/sturm', 'Sturm'], ['/de/traumsymbole/wolf', 'Wolf'], ['/de/traumsymbole/aufzug', 'Aufzug'], ['/de/traumsymbole/kerze', 'Kerze'], ['/de/traumsymbole/buch', 'Buch'], ['/de/traumsymbole/schnee', 'Schnee'], ['/de/traumsymbole/wuste', 'Wüste']],
    withoutFaq: [],
  },
  {
    tag: 'it', chosen: 'La tua scena: ', source: 'Leggi la variante «',
    sections: ['Cosa significa?', 'Scene frequenti', 'Domande da porsi', 'Lettura dettagliata', 'Variazioni comuni', 'Domande frequenti', 'Per approfondire'],
    ids: ['meaning', 'continua-in-noctalia', 'scenes', 'riflessione', 'questions', 'lettura', 'variations', 'faq', 'approfondire', 'correlati', 'conserva-in-noctalia'],
    pages: [['/it/simboli/tigre', 'Tigre'], ['/it/simboli/serpente', 'Serpente'], ['/it/simboli/oceano', 'Mare / Oceano'], ['/it/simboli/foresta', 'Foresta'], ['/it/simboli/casa', 'Casa'], ['/it/simboli/cadere', 'Cadere'], ['/it/simboli/farfalla', 'Farfalla'], ['/it/simboli/luna', 'Luna'], ['/it/simboli/porta', 'Porta'], ['/it/simboli/fuoco', 'Incendio / Fuoco'], ['/it/simboli/uccello', 'Uccello'], ['/it/simboli/treno', 'Treno'], ['/it/simboli/orologio-da-parete', 'Orologio da parete'], ['/it/simboli/acqua', 'Acqua'], ['/it/simboli/cane', 'Cane'], ['/it/simboli/denti', 'Denti (perdere i denti)'], ['/it/simboli/volare', 'Volare'], ['/it/simboli/automobile', 'Automobile'], ['/it/simboli/ponte', 'Ponte'], ['/it/simboli/gatto', 'Gatto'], ['/it/simboli/montagna', 'Montagna'], ['/it/simboli/chiave', 'Chiave'], ['/it/simboli/pioggia', 'Pioggia'], ['/it/simboli/scale', 'Scale'], ['/it/simboli/specchio', 'Specchio'], ['/it/simboli/cavallo', 'Cavallo'], ['/it/simboli/castello', 'Castello'], ['/it/simboli/stelle', 'Stelle'], ['/it/simboli/fiori', 'Fiori'], ['/it/simboli/bambino-neonato', 'Bambino (neonato)'], ['/it/simboli/tempesta', 'Tempesta'], ['/it/simboli/lupo', 'Lupo'], ['/it/simboli/ascensore', 'Ascensore'], ['/it/simboli/candela', 'Candela'], ['/it/simboli/libro', 'Libro'], ['/it/simboli/neve', 'Neve'], ['/it/simboli/deserto', 'Deserto']],
    withoutFaq: ['/it/simboli/scale', '/it/simboli/bambino-neonato'],
  },
  {
    tag: 'pt-BR', chosen: 'Sua cena: ', source: 'Ler a variação “',
    sections: ['O que significa?', 'Cenas comuns', 'Perguntas para refletir', 'Leitura detalhada', 'Variações comuns', 'Perguntas frequentes', 'Para saber mais'],
    ids: ['meaning', 'continuar-no-noctalia', 'scenes', 'reflexao', 'questions', 'leitura', 'variations', 'faq', 'para-saber-mais', 'relacionados', 'guardar-no-noctalia'],
    pages: [['/pt-br/simbolos/tigre', 'Tigre'], ['/pt-br/simbolos/cobra', 'Cobra'], ['/pt-br/simbolos/oceano-mar', 'Oceano / Mar'], ['/pt-br/simbolos/floresta', 'Floresta'], ['/pt-br/simbolos/casa', 'Casa'], ['/pt-br/simbolos/queda', 'Queda'], ['/pt-br/simbolos/borboleta', 'Borboleta'], ['/pt-br/simbolos/lua', 'Lua'], ['/pt-br/simbolos/porta', 'Porta'], ['/pt-br/simbolos/fogo', 'Fogo'], ['/pt-br/simbolos/passaro', 'Pássaro'], ['/pt-br/simbolos/trem', 'Trem'], ['/pt-br/simbolos/relogio-de-parede', 'Relógio de parede'], ['/pt-br/simbolos/agua', 'Água'], ['/pt-br/simbolos/cachorro', 'Cachorro'], ['/pt-br/simbolos/dentes-perder-os-dentes', 'Dentes (perder os dentes)'], ['/pt-br/simbolos/voar', 'Voar'], ['/pt-br/simbolos/carro', 'Carro'], ['/pt-br/simbolos/ponte', 'Ponte'], ['/pt-br/simbolos/gato', 'Gato'], ['/pt-br/simbolos/montanha', 'Montanha'], ['/pt-br/simbolos/chave', 'Chave'], ['/pt-br/simbolos/chuva', 'Chuva'], ['/pt-br/simbolos/escada', 'Escada'], ['/pt-br/simbolos/espelho', 'Espelho'], ['/pt-br/simbolos/cavalo', 'Cavalo'], ['/pt-br/simbolos/castelo', 'Castelo'], ['/pt-br/simbolos/estrelas', 'Estrelas'], ['/pt-br/simbolos/flores', 'Flores'], ['/pt-br/simbolos/bebe', 'Bebê'], ['/pt-br/simbolos/tempestade', 'Tempestade'], ['/pt-br/simbolos/lobo', 'Lobo'], ['/pt-br/simbolos/elevador', 'Elevador'], ['/pt-br/simbolos/vela', 'Vela'], ['/pt-br/simbolos/livro', 'Livro'], ['/pt-br/simbolos/neve', 'Neve'], ['/pt-br/simbolos/deserto', 'Deserto']],
    withoutFaq: ['/pt-br/simbolos/cobra', '/pt-br/simbolos/oceano-mar', '/pt-br/simbolos/queda', '/pt-br/simbolos/borboleta', '/pt-br/simbolos/lua', '/pt-br/simbolos/passaro', '/pt-br/simbolos/trem', '/pt-br/simbolos/dentes-perder-os-dentes', '/pt-br/simbolos/voar', '/pt-br/simbolos/carro', '/pt-br/simbolos/ponte', '/pt-br/simbolos/gato', '/pt-br/simbolos/montanha', '/pt-br/simbolos/chave', '/pt-br/simbolos/chuva', '/pt-br/simbolos/escada', '/pt-br/simbolos/espelho', '/pt-br/simbolos/cavalo', '/pt-br/simbolos/bebe', '/pt-br/simbolos/tempestade', '/pt-br/simbolos/elevador', '/pt-br/simbolos/livro', '/pt-br/simbolos/neve', '/pt-br/simbolos/deserto'],
  },
] as const;

// The page's language, its atlas words and the chosen scene's reading against its own card.
function readLocalizedAtlas() {
  const words = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const flat = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, '');
  const box = (selector: string) => {
    const node = document.querySelector(selector);
    if (!node || getComputedStyle(node).display === 'none') return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width, height: r.height };
  };
  const shown = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result')).filter(node => getComputedStyle(node).display !== 'none');
  const link = shown[0]?.querySelector<HTMLAnchorElement>('.atlas-link') ?? null;
  const card = link ? document.getElementById(link.hash.slice(1)) : null;
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  return {
    path: location.pathname,
    lang: document.documentElement.lang,
    title: words(document.querySelector('h1')),
    radios: document.querySelectorAll('.atlas-scene-input').length,
    index: Array.from(document.querySelectorAll('.atlas-rail a')).map(words),
    ids: Array.from(document.querySelectorAll('article.atlas :is(section, aside, .atlas-related)[id]')).map(node => node.id),
    railTargets: Array.from(document.querySelectorAll<HTMLAnchorElement>('.atlas-rail a')).every(link => document.getElementById(link.hash.slice(1))),
    checked: checked?.value ?? null,
    label: checked ? words(document.querySelector(`label[for="${checked.id}"] .atlas-scene-label`)) : null,
    chosen: words(shown[0]?.querySelector('.atlas-scene-chosen')),
    shown: flat(shown[0]?.querySelector('.atlas-scene-question')) + flat(shown[0]?.querySelector('.atlas-scene-excerpt')),
    card: flat(card?.querySelector('p')),
    cardTitle: words(card?.querySelector('h3')),
    cardSection: card?.closest('section')?.id ?? null,
    source: words(link),
    hash: location.hash,
    faqSchema: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(node => /"FAQPage"/.test(node.textContent ?? '')),
    hreflangs: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(node => node.getAttribute('hreflang')),
    article: words(document.querySelector('article.atlas')),
    viewport: { width: document.documentElement.clientWidth, height: innerHeight },
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    layout: { article: box('article.atlas'), rail: box('.atlas-rail'), list: box('.atlas-scene-list'), reflection: box('.atlas-reflection'), reading: box('.atlas-reading'), decor: box('.atlas-decor'), hero: box('.symbol-hero') },
    heroFit: getComputedStyle(document.querySelector('.symbol-hero-media img')!).objectFit,
  };
}

test('the thirty-seven atlas pages read in each of the six languages, with the French layout at 2560 and on a phone', { timeout: 900_000 }, async ({ app, browser, screen }) => {
  const words = ATLAS_LANGUAGES.map(language => [language.tag, language.chosen.trim(), language.source.trim()] as const);
  for (const language of ATLAS_LANGUAGES) {
    for (const [path, title] of language.pages) {
      const faq = !(language.withoutFaq as readonly string[]).includes(path);
      await browser.setViewport({ width: 2560, height: 1440 });
      await app.open(path + '.html');
      await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
      const wide = await browser.evaluate(readLocalizedAtlas);
      expect([wide.lang, wide.title, wide.radios], path).toEqual([language.tag, title, 3]);
      expect(wide.index, path).toEqual(language.sections.filter(section => faq || section !== language.sections[5]));
      expect(wide.ids, path).toEqual(language.ids.filter(id => faq || id !== 'faq'));
      expect([wide.railTargets, wide.faqSchema], path).toEqual([true, faq]);
      expect(wide.hreflangs, path).toEqual(['en', 'fr', 'es', 'de', 'it', 'pt-BR', 'x-default']);
      // The chosen scene's reading is its published card: whole, or for the tiger its question and the next sentence.
      expect(wide.chosen, path).toBe(language.chosen + wide.label);
      expect(wide.source.startsWith(language.source), path).toBe(true);
      expect(wide.cardSection, path).toBe('variations');
      if (path.endsWith('/tiger') || path.endsWith('/tigre')) expect(wide.card.startsWith(wide.shown) && wide.shown.length > 0, path).toBe(true);
      else expect(wide.shown, path).toBe(wide.card);
      // No word of another language's atlas.
      for (const [tag, chosen, source] of words) {
        if (tag !== language.tag) expect([wide.article.includes(chosen), wide.article.includes(source)], `${path} has no ${tag} atlas words`).toEqual([false, false]);
      }
      // The French composition at 2560: the index beside the plate, the art beside the reading, the reading beside the list.
      expect(wide.overflow, path).toBe(false);
      expect(wide.layout.article!.width).toBeGreaterThanOrEqual(wide.viewport.width * 0.88);
      expect(wide.layout.rail!.right).toBeLessThanOrEqual(wide.layout.list!.left);
      expect(wide.layout.decor!.left).toBeGreaterThanOrEqual(wide.layout.reading!.right);
      expect(wide.layout.reflection!.left).toBeGreaterThanOrEqual(wide.layout.list!.right);
      expect(wide.layout.reflection!.top).toBeLessThan(wide.layout.list!.bottom);

      // A phone: the 75svh hero from the top, one column, the reading under the list.
      await browser.setViewport({ width: 390, height: 844 });
      await app.open(path + '.html');
      await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
      const phone = await browser.evaluate(readLocalizedAtlas);
      expect([phone.overflow, phone.layout.hero!.top, phone.heroFit, phone.layout.rail, phone.layout.decor], path).toEqual([false, 0, 'cover', null, null]);
      expect(phone.layout.hero!.height).toBeCloseTo(844 * 0.75, 0);
      expect(phone.layout.reflection!.top).toBeGreaterThanOrEqual(phone.layout.list!.bottom);
    }
    await app.screenshot('atlas-' + language.tag + '-390');
  }
});

// Production serves /x as /x.html; the local server (python's http.server) does not. Links followed
// by a journey are answered with the generated page they name.
const serveCleanUrls = (browser: Browser) =>
  browser.route(/^http:\/\/127\.0\.0\.1:\d+\/(?:en|fr|es|de|it|pt-br)\/[^?#.]*[^/?#.]$/, route => route.fulfill({
    path: fileURLToPath(new URL('../../../docs' + new URL(route.request.url).pathname + '.html', import.meta.url)),
    contentType: 'text/html; charset=utf-8',
  }));

test('the language menu leads from the French moon atlas to the pt-br and the English one, where a scene and the phone anchors work in pt-br', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  await serveCleanUrls(browser);
  await browser.setViewport({ width: 1920, height: 1080 });
  await app.open('/fr/symboles/lune.html');
  await expect(screen.getByRole('heading', { level: 1, name: 'Lune' })).toBeVisible();
  // The generic pack renderer keeps the full painting and the full published
  // reading in step through all three choices, independently of the tiger.
  const frenchSecond = await browser.evaluate(() => document.querySelectorAll('.atlas-scene-label')[1].textContent!.trim());
  await screen.getByText(frenchSecond, { exact: true }).first().tap();
  await expect(screen.getByRole('radio').nth(1)).toBeChecked();
  await expectExpandedScene(browser, 'croissant');
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.inView)).toBe(true);
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'scene-croissant-expanded').state)).toBe('running');
  await screen.getByRole('radio').nth(1).press('ArrowDown');
  await expect(screen.getByRole('radio').nth(2)).toBeChecked();
  await expectExpandedScene(browser, 'double');
  await screen.getByRole('radio').nth(2).press('ArrowDown');
  await expect(screen.getByRole('radio').nth(0)).toBeChecked();
  await expectExpandedScene(browser, 'pleine');
  await app.screenshot('atlas-fr-moon-expanded-1920');
  expect(await browser.evaluate(scrollToY, 0)).toBe(0);
  await screen.getByRole('button', { name: 'Choisir la langue' }).tap();
  await screen.getByRole('menuitem', { name: 'Português (Brasil)' }).tap();
  await expect(screen.getByRole('heading', { level: 1, name: 'Lua' })).toBeVisible();
  let read = await browser.evaluate(readLocalizedAtlas);
  expect([read.path, read.lang, read.checked, read.chosen]).toEqual(['/pt-br/simbolos/lua', 'pt-BR', 'pleine', 'Sua cena: Lua cheia']);

  // The second scene from the mouse, then back to the first from the keyboard.
  await screen.getByText('Lua nova ou lua escura', { exact: true }).first().tap();
  await expect(screen.getByRole('radio', { name: /^Lua nova ou lua escura/ })).toBeChecked();
  read = await browser.evaluate(readLocalizedAtlas);
  expect([read.checked, read.chosen, read.source, read.shown]).toEqual(['croissant', 'Sua cena: Lua nova ou lua escura', 'Ler a variação “Lua nova ou lua escura”', read.card]);
  await expectExpandedScene(browser, 'croissant');
  await screen.getByRole('radio', { name: /^Lua nova ou lua escura/ }).press('ArrowUp');
  await expect(screen.getByRole('radio', { name: /^Lua cheia/ })).toBeChecked();
  await expectExpandedScene(browser, 'pleine');
  await app.screenshot('atlas-pt-br-moon-1920');

  // A phone: the section bar in Portuguese lands each section below it, and the source link of the
  // chosen scene lands on its own card.
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/pt-br/simbolos/lua.html');
  await expect(screen.getByRole('heading', { level: 1, name: 'Lua' })).toBeVisible();
  const bar = () => browser.evaluate(() => ({
    label: document.querySelector('.symbol-jump-nav')!.getAttribute('aria-label'),
    links: Array.from(document.querySelectorAll<HTMLAnchorElement>('.symbol-jump-link')).map(link => [link.hash, link.textContent!.trim()]),
    active: Array.from(document.querySelectorAll('.symbol-jump-link.is-active')).map(link => (link as HTMLAnchorElement).hash),
    bottom: document.querySelector('.symbol-jump-nav')!.getBoundingClientRect().bottom,
    variationsTitle: document.querySelector('#variations h2')!.getBoundingClientRect().top,
  }));
  expect(await bar().then(read => [read.label, read.links])).toEqual(['Seções do símbolo', [['#meaning', 'Sentido'], ['#questions', 'Perguntas'], ['#variations', 'Variações']]]);
  await screen.getByRole('link', { name: /^Variações$/ }).tap();
  await expect.poll(() => bar().then(read => read.active)).toEqual(['#variations']);
  await expect.poll(() => bar().then(read => read.variationsTitle >= read.bottom && read.variationsTitle < 844 / 2)).toBe(true);
  expect(await browser.evaluate(scrollToY, 0)).toBe(0);
  await screen.getByText('Duas luas ou mais', { exact: true }).first().tap();
  await expectExpandedScene(browser, 'double');
  await expect.poll(() => browser.evaluate(readExpandedScene).then(read => read?.inView)).toBe(true);
  await app.screenshot('atlas-pt-br-moon-expanded-390');
  await screen.getByRole('link', { name: 'Ler a variação “Duas luas ou mais”' }).tap();
  await expect.poll(() => browser.evaluate(() => window.location.hash)).toBe('#variacao-duas-luas');
  await expect.poll(() => browser.evaluate(() => {
    const card = document.querySelector(':target');
    const title = card?.querySelector('h3')?.getBoundingClientRect();
    const covered = document.querySelector('.symbol-jump-nav')!.getBoundingClientRect().bottom;
    return [card?.closest('section')?.id ?? null, card?.querySelector('h3')?.textContent?.trim() ?? null, Boolean(title && title.top >= covered && title.top < innerHeight / 2)];
  })).toEqual(['variations', 'Duas luas ou mais', true]);
  await app.screenshot('atlas-pt-br-moon-390-variant');

  // The phone menu's language list leads on to the English atlas (the navbar shows again at the top).
  expect(await browser.evaluate(scrollToY, 0)).toBe(0);
  await screen.getByRole('button', { name: 'Menu de navegação' }).tap();
  await screen.getByRole('link', { name: 'English', exact: true }).tap();
  await expect(screen.getByRole('heading', { level: 1, name: 'Moon' })).toBeVisible();
  read = await browser.evaluate(readLocalizedAtlas);
  expect([read.path, read.lang, read.chosen]).toEqual(['/en/symbols/moon', 'en', 'Your scene: Full moon']);
});

test('the symbol article, a missing FAQ or a thumbnail that fails stays in the page\'s language', { timeout: 120_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  // The complete deer pack keeps the same Portuguese article and localized content links.
  await app.open('/pt-br/simbolos/cervo.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await browser.evaluate(() => ({
    lang: document.documentElement.lang,
    atlas: document.querySelectorAll('article.atlas').length,
    bar: document.querySelector('.symbol-jump-nav')?.getAttribute('aria-label') ?? null,
    jumps: Array.from(document.querySelectorAll('.symbol-jump-link')).map(link => link.textContent!.trim()),
    // Internal links of the content, outside the language menus.
    foreign: Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href^="/"]')).map(link => link.getAttribute('href')!).filter(href => !href.startsWith('/pt-br/')),
  }))).toEqual({ lang: 'pt-BR', atlas: 1, bar: 'Seções do símbolo', jumps: ['Sentido', 'Perguntas', 'Variações'], foreign: [] });

  // Interpretations link to pt-br pages; the forest keeps its English blog article on purpose (no pt-br blog).
  for (const [path, foreign] of [['/pt-br/simbolos/cemiterio.html', []], ['/pt-br/simbolos/floresta.html', ['/en/blog/dream-meanings']]] as const) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>('main .prose a[href^="/"]')).map(link => link.getAttribute('href')!).filter(href => !href.startsWith('/pt-br/'))), path).toEqual(foreign);
  }

  // An atlas whose pt catalog has no FAQ yet: no FAQ section, entry or structured data, nothing borrowed.
  await app.open('/pt-br/simbolos/cobra.html');
  await expect(screen.getByRole('heading', { level: 1, name: 'Cobra' })).toBeVisible();
  const snake = await browser.evaluate(readLocalizedAtlas);
  expect([snake.ids.includes('faq'), snake.faqSchema, snake.article.includes('FAQ')]).toEqual([false, false, false]);

  // A scene thumbnail that fails keeps its choice and the reading in Portuguese.
  await browser.route(/\/img\/symbols\/atlas-six-v2\/moon\/scene-croissant-/, route => route.fulfill({ status: 404, body: '' }));
  await app.open('/pt-br/simbolos/lua.html');
  await expect(screen.getByRole('heading', { level: 1, name: 'Lua' })).toBeVisible();
  await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
  await expect.poll(() => browser.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[data-living-surface="scene-croissant"] img')!;
    return img.complete && img.naturalWidth === 0;
  }), { timeout: 15_000 }).toBe(true);
  await screen.getByText('Lua nova ou lua escura', { exact: true }).first().tap();
  await expect(screen.getByRole('radio', { name: /^Lua nova ou lua escura/ })).toBeChecked();
  const moon = await browser.evaluate(readLocalizedAtlas);
  expect([moon.checked, moon.chosen, moon.shown]).toEqual(['croissant', 'Sua cena: Lua nova ou lua escura', moon.card]);
  await app.screenshot('atlas-pt-br-moon-broken-thumbnail-390');
});

test('the pt-br dictionary links every pt-br symbol, searches and filters in Portuguese, and its translations link to each other', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  await serveCleanUrls(browser);
  await browser.setViewport({ width: 1920, height: 1080 });
  await app.open('/pt-br/guides/dicionario-simbolos-sonhos.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const links = () => browser.evaluate(() => {
    const internal = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href^="/"]')).map(link => link.getAttribute('href')!);
    return {
      lang: document.documentElement.lang,
      symbols: new Set(internal.filter(href => /^\/pt-br\/simbolos\/[a-z0-9-]+$/.test(href))).size,
      foreign: internal.filter(href => !href.startsWith('/pt-br/')),
      blog: internal.filter(href => href.startsWith('/pt-br/blog/')),
      alternates: Object.fromEntries(Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(node => [node.getAttribute('hreflang'), new URL(node.getAttribute('href')!).pathname])),
    };
  });
  const dictionary = await links();
  // 240 symbols and 8 categories, nothing outside pt-br, no blog.
  expect([dictionary.lang, dictionary.symbols, dictionary.foreign, dictionary.blog]).toEqual(['pt-BR', 248, [], []]);
  expect(dictionary.alternates).toEqual({
    en: '/en/guides/dream-symbols-dictionary', fr: '/fr/guides/dictionnaire-symboles-reves', es: '/es/guides/diccionario-simbolos-suenos',
    de: '/de/guides/traumsymbole-lexikon', it: '/it/guides/dizionario-simboli-sogni', 'pt-BR': '/pt-br/guides/dicionario-simbolos-sonhos',
    'x-default': '/en/guides/dream-symbols-dictionary',
  });
  // A symbol of the dictionary opens its pt-br page, whose nav leads back to the dictionary.
  await screen.getByRole('link', { name: /^Lua\b/ }).first().tap();
  await expect(screen.getByRole('heading', { level: 1, name: 'Lua' })).toBeVisible();
  expect(await browser.evaluate(() => location.pathname)).toBe('/pt-br/simbolos/lua');
  expect(await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>('#navbar a')).some(link => link.getAttribute('href') === '/pt-br/guides/dicionario-simbolos-sonhos'))).toBe(true);
  // The French dictionary offers the pt-br one in its language menu.
  await app.open('/fr/guides/dictionnaire-symboles-reves.html');
  await screen.getByRole('button', { name: 'Choisir la langue' }).tap();
  await screen.getByRole('menuitem', { name: 'Português (Brasil)' }).tap();
  await expect.poll(() => browser.evaluate(() => [location.pathname, document.documentElement.lang])).toEqual(['/pt-br/guides/dicionario-simbolos-sonhos', 'pt-BR']);

  // On a phone, a search in Portuguese, with or without its accent, finds the same three symbols; the
  // search moves to the sticky field, which keeps the text.
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/pt-br/guides/dicionario-simbolos-sonhos.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  // The field on screen: the hero's, then, once a search starts, the sticky bar's (the hero's leaves the page).
  const search = screen.getByRole('textbox', { name: 'Busque um símbolo (água, cobra, queda…)' }).first();
  const results = () => browser.evaluate(() => ({
    focused: document.activeElement?.id ?? null,
    sticky: document.querySelector<HTMLInputElement>('#stickySearch')!.value,
    shown: Array.from(document.querySelectorAll<HTMLElement>('.symbol-card')).filter(card => getComputedStyle(card).display !== 'none').map(card => card.dataset.symbol ?? '').sort(),
  }));
  await search.tap();
  await search.fill('Cemitério');
  await expect.poll(results).toEqual({ focused: 'stickySearch', sticky: 'Cemitério', shown: ['caixao', 'cemiterio', 'igreja'] });
  await search.fill('cemiterio');
  await expect.poll(results).toEqual({ focused: 'stickySearch', sticky: 'cemiterio', shown: ['caixao', 'cemiterio', 'igreja'] });
  await screen.getByRole('link', { name: 'Cemitério', exact: true }).first().tap();
  await expect(screen.getByRole('heading', { level: 1, name: 'Cemitério' })).toBeVisible();
  expect(await browser.evaluate(() => [location.pathname, document.documentElement.lang])).toEqual(['/pt-br/simbolos/cemiterio', 'pt-BR']);

  // Back on the dictionary, the search cleared, the Places category leads to its pt-br page and symbols.
  await browser.back();
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await search.fill('');
  await expect.poll(() => results().then(read => read.shown.length)).toBe(240);
  await screen.getByRole('link', { name: /^Lugares/ }).tap();
  await expect(screen.getByRole('heading', { level: 1, name: 'Símbolos dos sonhos: Lugares' })).toBeVisible();
  expect(await browser.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a.symbol-index-card')).map(link => link.getAttribute('href')!);
    return { path: location.pathname, lang: document.documentElement.lang, cards: cards.length, foreign: cards.filter(href => !/^\/pt-br\/simbolos\/[a-z0-9-]+$/.test(href)), cemetery: cards.includes('/pt-br/simbolos/cemiterio') };
  })).toEqual({ path: '/pt-br/simbolos/lugares', lang: 'pt-BR', cards: 40, foreign: [], cemetery: true });
  await app.screenshot('dictionary-pt-br-places-390');
});

test('site media keep their original pixels and two effects through the configured CDN on desktop and mobile', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  const config = JSON.parse(readFileSync(new URL('../../../docs-src/config/site-media-storage.json', import.meta.url), 'utf8')) as { delivery: string; publicOrigin: string };
  const manifest = JSON.parse(readFileSync(new URL('../../../docs-src/config/site-media.json', import.meta.url), 'utf8')) as { release: string; files: Array<[string, number, string]> };
  const expected = new Map(manifest.files.map(row => [row[0], row]));
  const origin = config.delivery === 'cdn' ? config.publicOrigin : new URL(app.baseUrl!).origin;
  for (const [width, height] of [[2560, 1440], [390, 844]]) {
    await browser.setViewport({ width, height });
    await app.open('/fr/symboles/cadeau.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero')?.state)).toBe('running');
    const hero = surfaceNamed(await browser.evaluate(readSurfaces), 'hero');
    expect(hero.channels).toEqual(['a', 'b']);
    expect(hero.opaque.every(count => count > 0)).toBe(true);
    expect(hero.textures[0]).not.toBe(hero.textures[1]);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').frames.map((frame, index) => frame !== hero.frames[index]))).toEqual([true, true]);
    const layout = await browser.evaluate(measureHero);
    expect(layout.naturalWidth).toBeGreaterThan(0);
    expect(layout.overflow).toBe(false);
    expect(new URL(layout.src).pathname).toMatch(width < 768 ? /\/portrait-/ : /\/hero-/);
    await app.screenshot('media-cdn-' + width + '-hero');

    if (width > 768) {
      await browser.evaluate(() => { document.querySelector('[data-living-surface="plate"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'plate')?.state)).toBe('running');
      expect(surfaceNamed(await browser.evaluate(readSurfaces), 'plate').opaque.every(count => count > 0)).toBe(true);
      await app.screenshot('media-cdn-' + width + '-plate');
    }
    await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    await expect(screen.getByRole('radio')).toHaveCount(3);
    const second = await browser.evaluate(() => document.querySelectorAll('.atlas-scene-label')[1].textContent!.trim());
    await screen.getByText(second, { exact: true }).first().tap();
    await expect(screen.getByRole('radio').nth(1)).toBeChecked();
    await app.screenshot('media-cdn-' + width + '-scenes');

    // Only inspect files the real journey loaded. In particular this must not
    // cause the hidden side painting to be requested on a phone.
    const loaded = await browser.evaluate(async (mediaBase: string) => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('.symbol-hero-media img, .atlas-decor img, .atlas-scene-thumb img, .slp-t'));
      const urls = [...new Set(images.filter(img => img.complete && img.naturalWidth > 0 && img.currentSrc).map(img => img.currentSrc))];
      return Promise.all(urls.map(async original => {
        const imagePath = mediaBase && original.startsWith(mediaBase) ? original.slice(mediaBase.length) : new URL(original).pathname.replace(/^\//, '');
        const response = await fetch(original, { mode: 'cors', credentials: 'omit' });
        const bytes = await response.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return { path: imagePath, direct: !mediaBase || original.startsWith(mediaBase), redirected: response.redirected, origin: new URL(response.url).origin,
          ok: response.ok, type: response.headers.get('content-type') ?? '', bytes: bytes.byteLength,
          digest: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
      }));
    }, config.delivery === 'cdn' ? config.publicOrigin + '/releases/' + manifest.release + '/' : '');
    expect(loaded.length).toBeGreaterThanOrEqual(3);
    for (const image of loaded) {
      const entry = expected.get(image.path);
      expect(entry, image.path).toBeDefined();
      expect([image.ok, image.origin, image.bytes, image.digest], image.path).toEqual([true, origin, entry![1], entry![2]]);
      expect([image.direct, image.redirected], image.path).toEqual([true, false]);
      expect(image.type.startsWith('image/')).toBe(true);
    }
    if (width < 768) expect(loaded.some(image => image.path.includes('/plate-'))).toBe(false);
  }
});

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`landing scroll dogfood preserves comets, reversal and reduced motion at ${width}px`, {
    tags: ['framerate'], timeout: 180_000,
  }, async ({ app, browser, screen }) => {
    await browser.setViewport({ width, height });
    await app.open('/fr/');
    const consent = screen.getByRole('button', 'Continuer sans mesure', { visible: true });
    if (await consent.count()) await consent.tap();
    await expect.poll(() => browser.evaluate(() => Boolean(document.querySelector('.oh-intro-skip'))
      || !document.documentElement.classList.contains('exp-intro-pending'))).toBe(true);
    const skip = browser.locator('.oh-intro-skip');
    if (await skip.count()) await skip.tap();
    await expect.poll(() => browser.evaluate(() => document.documentElement.classList.contains('exp-journey')
      && !document.documentElement.classList.contains('exp-intro-pending'))).toBe(true);
    // Enter the actual pinned scene before using its visible navigation.
    await browser.evaluate(() => {
      const track = document.querySelector('.oh-dreamspace')!;
      window.scrollTo({ top: track.getBoundingClientRect().top + window.scrollY + 80, behavior: 'instant' });
      return true;
    });
    const map = screen.getByRole('button', 'Ce qui les relie', { visible: true });
    await expect(map).toBeVisible();
    await app.screenshot('landing-gallery');
    await map.tap();
    const next = screen.getByRole('button', 'Rêve suivant', { visible: true });
    await expect(next).toBeEnabled();
    await next.tap();
    await expect.poll(() => browser.evaluate(() => [...document.querySelectorAll<HTMLElement>('.oh-symbol-comet')]
      .some(el => !el.hidden && Number(getComputedStyle(el).opacity) > 0.1))).toBe(true);
    await app.screenshot('landing-comets');
    // Resizing during a flight must remeasure its endpoints, even at the same progress.
    await browser.setViewport({ width: width === 390 ? 320 : 1100, height });
    await expect.poll(() => browser.evaluate(() => document.querySelector('.oh-starmap-step')?.textContent ?? null)).toBe('2');
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const previous = screen.getByRole('button', 'Rêve précédent', { visible: true });
    await previous.focus();
    await browser.keyboard.press('Enter');
    await expect.poll(() => browser.evaluate(() => document.querySelector('.oh-starmap-step')?.textContent ?? null)).toBe('1');
    await expect(previous).toBeDisabled();
    await app.screenshot('landing-reversed');
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await app.open('/fr/');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await browser.evaluate(() => document.documentElement.dataset.expTier ?? null)).toBe('static');
    expect(await browser.evaluate(() => document.querySelectorAll('.oh-symbol-comet').length)).toBe(0);
    await app.screenshot('landing-reduced-motion');
  });
}
