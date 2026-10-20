import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
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
    objectPosition: getComputedStyle(img).objectPosition,
    paintings: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
      .filter(path => path.startsWith('/img/seo/symbols-v2/') || /\/tiger-mobile-v4-[0-9]+w\./.test(path)),
  };
}

test('symbol artwork fills the page from behind the navbar up to 2560px', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')) as {
    symbols: Array<{ id: string; fr: { slug: string; name: string } }>;
  };
  const ids = ['sex','cheating','kissing','attack','killing','fighting','eating','kidnapping','moving-house','war','vomiting','nails','tsunami','flowers','tiger','deer','pig','monkey','lizard','bat','toilet','church','beach','castle','swimming-pool','alien','celebrity','boss','crush','witch','clown','gun','knife','wallet','doll','gold','coffin','stars','sky','god'];
  // Atlas pages since lot 05: their hero is the atlas painting; every other id keeps its classic artwork.
  const atlasIds = ['flowers', 'castle', 'stars'];
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
    if (atlasIds.includes(id)) {
      expect(new URL(image.src).pathname).toMatch(new RegExp('^/img/symbols/atlas-six-v2/' + id + '/hero-[0-9]+-[0-9a-f]{12}\\.(?:avif|webp)$'));
    } else {
      expect(image.src).toMatch(new RegExp('/' + id + '-v1-[0-9]+w\\.(?:webp|avif)$'));
    }
    checkLayout(image);
    if (['sex', 'tiger', 'god'].includes(id)) await app.screenshot('symbol-' + id + '-wide');
  }
  for (const [width, height, id] of [
    [1920, 1200, 'angel'], [2560, 1600, 'tiger'], [2568, 1600, 'angel'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    checkLayout(await browser.evaluate(measureHero));
    await app.screenshot('symbol-' + id + '-' + width);
  }
  // On a phone held upright every symbol page takes 75svh from the top, behind the navbar. A page
  // without a pack crops its own 16:9 painting (cover), centred or on the point its framing names
  // for a subject painted off-centre.
  for (const [width, height, id, position] of [
    [390, 844, 'angel', '50% 50%'], [320, 740, 'moving-house', '50% 50%'], [390, 844, 'alien', '19% 50%'],
  ] as const) {
    await browser.setViewport({ width, height });
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(measureHero);
    expect(image.naturalWidth).toBeGreaterThan(0);
    // Its own landscape painting, not a portrait one.
    expect(new URL(image.src).pathname).toMatch(new RegExp('^/img/seo/symbols-v2/' + id + '-v[0-9]+-[0-9]+w\\.(?:webp|avif)$'));
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

function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' });
  return window.scrollY;
}

test('at a phone viewport a page without a pack takes the 75svh hero by cropping its own painting, without a motion script or file', async ({ app, browser, screen }) => {
  // At the default 390x844 phone viewport, a page without a pack takes the same 75svh hero by
  // cropping its own 16:9 painting (cover), without any motion script or the tiger's files.
  for (const path of ['/fr/symboles/cerf.html', '/en/symbols/deer.html', '/pt-br/simbolos/cervo.html']) {
    await app.open(path);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readMotionLoads).then(read => read.loaded)).toBe(true);
    expect(await browser.evaluate(readMotionLoads)).toEqual({ scripts: 0, requests: 0, stages: 0, marked: false, ratio: Math.round(390 / (844 * 0.75) * 100) / 100, objectFit: 'cover', loaded: true });
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
  const shownBox = visible[0]?.getBoundingClientRect();
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
    shownInView: shownBox ? shownBox.top >= 0 && shownBox.bottom <= window.innerHeight + 1 : false,
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

test('the French tiger atlas reads like a dictionary entry and shows each published scene from mouse or keyboard', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  // Every paragraph of the published interpretation, whole, in its zone: the first opens the plate,
  // the others (but the fictional journal example, which the page leaves out) make the detailed reading.
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
    if (paragraph.startsWith('Exemplefictifdejournal')) return;
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

  // A phone: one column without overflow, the choices right after the opening, the chosen
  // scene's reading right under them and the questions after it, and the hidden art never fetched.
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
  expect(phone.reflection!.top).toBeGreaterThanOrEqual(phone.list!.bottom);
  expect(phone.reflection!.left).toBeCloseTo(phone.list!.left, 0);
  expect(phone.questionsBox!.top).toBeGreaterThanOrEqual(phone.reflection!.bottom);
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

  // A symbol without a pack reads in the same article: its own sections in the same order, the app
  // after its meaning and questions, and no scene, side illustration or motion script.
  await app.open('/fr/symboles/cerf.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await browser.evaluate(() => ({
    articles: document.querySelectorAll('article.atlas').length,
    packParts: document.querySelectorAll('.atlas-scene-input, .atlas-decor, article.max-w-3xl, script[src*="symbol-living"], #symbol-living-config').length,
    ids: Array.from(document.querySelectorAll('article.atlas :is(section, aside)[id]')).map(node => node.id),
    jumps: Array.from(document.querySelectorAll('.symbol-jump-link')).map(link => link.textContent!.trim()),
  }))).toEqual({
    articles: 1, packParts: 0,
    ids: ['meaning', 'questions', 'continuer-noctalia', 'lecture', 'variations', 'faq', 'plus-loin', 'garder-noctalia'],
    jumps: ['Sens', 'Questions', 'Variantes'],
  });
  await app.screenshot('symbol-cerf-390');
});

// The French atlas pages after the tiger, read as the same atlas, with the tiger's grounds, type
// and UI colours, and the tiger's three kinds of painting: the hero, a cut-out side illustration
// beside the meaning and a thumbnail per scene. Every painting carries two distinct raster effects,
// channel a (layer) and channel b (accent). The list is literal: a page joins it only once it is
// approved. The journeys need the delivered paintings and textures
// (docs-src/config/symbol-atlas-six-assets.json).
const ATLAS_PAGES = [
  // First batch.
  { id: 'snake', slug: 'serpent', scenes: ['morsure', 'calme', 'mue'] },
  { id: 'ocean', slug: 'mer', scenes: ['calme', 'tempete', 'vague'] },
  { id: 'forest', slug: 'foret', scenes: ['sombre', 'perdu', 'chemin'] },
  { id: 'house', slug: 'maison', scenes: ['inconnue', 'enfance', 'pieces'] },
  { id: 'falling', slug: 'chute', scenes: ['hauteur', 'sursaut', 'voler'] },
  { id: 'butterfly', slug: 'papillon', scenes: ['pose', 'chrysalide', 'prisonnier'] },
  // Second batch: the moon (the witness), then the five others.
  { id: 'moon', slug: 'lune', scenes: ['pleine', 'croissant', 'double'] },
  { id: 'door', slug: 'porte', scenes: ['ouverte', 'verrouillee', 'choix'] },
  { id: 'fire', slug: 'feu', scenes: ['reconfort', 'incendie', 'fumee'] },
  { id: 'bird', slug: 'oiseau', scenes: ['libre', 'cage', 'chant'] },
  { id: 'train', slug: 'train', scenes: ['voyage', 'gare', 'tunnel'] },
  { id: 'clock', slug: 'horloge', scenes: ['arretee', 'aiguilles', 'clocher'] },
  // Third batch.
  { id: 'water', slug: 'eau', scenes: ['claire', 'trouble', 'montee'] },
  { id: 'dog', slug: 'chien', scenes: ['poursuite', 'familier', 'meute'] },
  { id: 'teeth', slug: 'dents', scenes: ['chute', 'casse', 'repousse'] },
  { id: 'flying', slug: 'voler', scenes: ['libre', 'difficile', 'ras-sol'] },
  { id: 'car', slug: 'voiture', scenes: ['conduite', 'passager', 'panne'] },
  { id: 'bridge', slug: 'pont', scenes: ['traversee', 'rupture', 'hesitation'] },
  // Fourth batch.
  { id: 'cat', slug: 'chat', scenes: ['affectueux', 'griffes', 'noir'] },
  { id: 'mountain', slug: 'montagne', scenes: ['ascension', 'sommet', 'obstacle'] },
  { id: 'key', slug: 'cle', scenes: ['trouver', 'perdre', 'serrure'] },
  { id: 'rain', slug: 'pluie', scenes: ['douce', 'averse', 'fenetre'] },
  { id: 'stairs', slug: 'escalier', scenes: ['monter', 'descendre', 'infini'] },
  { id: 'mirror', slug: 'miroir', scenes: ['reflet', 'brise', 'absent'] },
  // Fifth batch.
  { id: 'horse', slug: 'cheval', scenes: ['balade', 'emballe', 'liberte'] },
  { id: 'castle', slug: 'chateau', scenes: ['exploration', 'grille', 'ruine'] },
  { id: 'stars', slug: 'etoiles', scenes: ['ciel', 'filante', 'guide'] },
  { id: 'flowers', slug: 'fleurs', scenes: ['bouquet', 'fanees', 'prairie'] },
  { id: 'baby', slug: 'bebe', scenes: ['soins', 'pleurs', 'trouver'] },
  { id: 'storm', slug: 'orage', scenes: ['approche', 'expose', 'abri'] },
  // Sixth batch.
  { id: 'wolf', slug: 'loup', scenes: ['solitaire', 'meute', 'poursuite'] },
  { id: 'elevator', slug: 'ascenseur', scenes: ['montee', 'descente', 'bloque'] },
  { id: 'candle', slug: 'bougie', scenes: ['seule', 'anniversaire', 'ceremonie'] },
  { id: 'book', slug: 'livre', scenes: ['illisible', 'blanches', 'bibliotheque'] },
  { id: 'snow', slug: 'neige', scenes: ['chute', 'bloque', 'marche'] },
  { id: 'desert', slug: 'desert', scenes: ['seul', 'tempete', 'oasis'] },
] as const;

type SixData = {
  symbols: Array<{ id: string; relatedSymbols?: string[]; fr: { slug: string; askYourself: string[]; faq: unknown[] } }>;
};

function atlasSixSource(id: string) {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')) as SixData;
  const extended = JSON.parse(readFileSync(new URL('../../../data/dream-symbols-extended.json', import.meta.url), 'utf8')) as {
    symbols: Record<string, { fr: { fullInterpretation: string; variations: Array<{ context: string; meaning: string }> } }>;
  };
  const flat = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, '');
  const symbol = catalog.symbols.find(item => item.id === id)!;
  return {
    paragraphs: (extended.symbols[id].fr.fullInterpretation.match(/<p>[\s\S]*?<\/p>/g) ?? []).map(flat),
    variations: extended.symbols[id].fr.variations.map(v => flat(v.meaning)),
    questions: symbol.fr.askYourself.length,
    faq: symbol.fr.faq.length,
  };
}

function readAtlasSix() {
  const hero = document.querySelector<HTMLElement>('.symbol-hero')!;
  const figure = hero.querySelector<HTMLElement>('.symbol-hero-figure')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const config = JSON.parse(document.getElementById('symbol-living-config')?.textContent ?? 'null') as {
    surfaces: Array<{ name: string; depth?: number; scenes: Record<string, { match: string; layers: { channel: string; src: string }[] }> }>;
  } | null;
  const flat = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, '');
  const box = (node: Element | null) => {
    if (!node || getComputedStyle(node).display === 'none') return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width, height: r.height };
  };
  const shown = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result')).filter(node => getComputedStyle(node).display !== 'none');
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  // The label and the card title may differ only by a non-breaking space (French « : »).
  const spaced = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const label = checked ? spaced(document.querySelector(`label[for="${checked.id}"] .atlas-scene-label`)) : null;
  const card = Array.from(document.querySelectorAll('#variations .variation-card')).find(node => spaced(node.querySelector('h3')) === label);
  const transform = getComputedStyle(figure).transform.match(/^matrix\(([^)]+)\)$/);
  const animations = document.getAnimations().filter(animation => animation instanceof CSSAnimation && (animation.effect as KeyframeEffect | null)?.target?.closest('.slp-stage'));
  const cs = getComputedStyle(img);
  const painted = cs.objectFit === 'cover' && img.naturalWidth
    ? img.naturalWidth * Math.max(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
    : img.clientWidth;
  return {
    config,
    living: hero.getAttribute('data-living'),
    scene: hero.getAttribute('data-living-scene'),
    state: hero.getAttribute('data-living-motion-state'),
    reasons: hero.getAttribute('data-living-motion-reasons'),
    src: img.currentSrc,
    objectFit: cs.objectFit,
    painted,
    hero: box(hero)!,
    viewport: { width: document.documentElement.clientWidth, height: innerHeight },
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollY: window.scrollY,
    figureShift: transform ? Number(transform[1].split(',')[5]) : 0,
    paintingAnimations: img.getAnimations().length + figure.getAnimations().filter(animation => animation instanceof CSSAnimation).length,
    // Every layer animation moves transform and opacity only.
    properties: [...new Set(animations.flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes().flatMap(frame => Object.keys(frame).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)))))].sort(),
    // A moving layer swings around its rest position: it starts on the mirror of its last translation
    // (a start the browser rejected reads as none).
    unbalanced: animations.filter(animation => {
      const frames = (animation.effect as KeyframeEffect).getKeyframes();
      if (!frames.some(frame => frame.transform && frame.transform !== 'none')) return false;
      const at = (frame: ComputedKeyframe) => String(frame.transform ?? '').match(/^translate3d\((-?[\d.]+)%, (-?[\d.]+)%, 0px\)$/);
      const start = at(frames[0]), end = at(frames[frames.length - 1]);
      return !start || !end || Number(start[1]) !== -Number(end[1]) || Number(start[2]) !== -Number(end[2]);
    }).map(animation => (animation as CSSAnimation).animationName),
    playStates: [...new Set(animations.map(animation => animation.playState))],
    toggles: hero.querySelectorAll('.slp-toggle').length,
    article: box(document.querySelector('article.atlas')),
    rail: box(document.querySelector('.atlas-rail')),
    list: box(document.querySelector('.atlas-scene-list')),
    reflection: box(document.querySelector('.atlas-reflection')),
    reading: box(document.querySelector('.atlas-reading')),
    decor: box(document.querySelector('.atlas-decor')),
    plate: document.querySelector('.atlas-decor')?.getAttribute('data-living-surface') ?? null,
    // Each thumbnail keeps its effects inside its own frame, clear of its label.
    thumbsClear: Array.from(document.querySelectorAll('.atlas-scene-thumb')).map(thumb => {
      const frame = thumb.getBoundingClientRect(), text = thumb.closest('label')!.querySelector('.atlas-scene-text')!.getBoundingClientRect();
      return getComputedStyle(thumb).overflow === 'hidden' && frame.right <= text.left + 0.5;
    }),
    // The tiger's UI colours, never a per-symbol tint.
    colours: [
      getComputedStyle(document.querySelector('.aurora-bg')!).backgroundImage,
      getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.querySelector('.atlas-kicker')!).color,
      getComputedStyle(document.querySelector('article.atlas .symbol-h2')!).color,
      getComputedStyle(document.querySelector('.atlas-scene-input:checked + .atlas-scene')!).borderTopColor,
      getComputedStyle(document.querySelector('.atlas-scene-input:checked + .atlas-scene .atlas-scene-mark')!).backgroundColor,
      getComputedStyle(document.querySelector('.atlas-primary')!).backgroundColor,
    ],
    zones: { meaning: flat(document.querySelector('#meaning')), lecture: flat(document.querySelector('#lecture')), variations: flat(document.querySelector('#variations')) },
    counts: {
      opening: document.querySelectorAll('#meaning .prose > p').length,
      continuation: document.querySelectorAll('#lecture .prose > p').length,
      variations: document.querySelectorAll('#variations .variation-card').length,
      questions: document.querySelectorAll('#questions .symbol-question-item').length,
      faq: document.querySelectorAll('#faq .symbol-faq-card').length,
      faqSchema: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(node => JSON.parse(node.textContent!)).find(node => node['@type'] === 'FAQPage')?.mainEntity.length ?? 0,
      thumbnails: document.querySelectorAll('.atlas-scene-thumb').length,
    },
    checked: checked?.value ?? null,
    shown: shown.map(node => ({ scene: node.dataset.scene ?? '', inReading: Boolean(node.closest('.atlas-reflection')), text: flat(node.querySelector('.atlas-scene-question')) + flat(node.querySelector('.atlas-scene-excerpt')) })),
    card: card ? flat(card.querySelector('p')) : null,
    navGround: getComputedStyle(document.querySelector('#navbar')!).backgroundColor,
  };
}

type AtlasSix = Awaited<ReturnType<typeof readAtlasSix>>;

// The reading beside the list is the chosen published variation card, whole.
const expectSixScene = (read: AtlasSix, scene: string) => {
  expect(read.checked).toBe(scene);
  expect(read.shown.map(shown => [shown.scene, shown.inReading])).toEqual([[scene, true]]);
  expect(read.shown[0].text).toBe(read.card ?? 'no card');
};

test('the French atlas pages keep every published block and show each chosen variation whole', { timeout: 300_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 2560, height: 1440 });
  await app.open('/fr/symboles/tigre.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const tiger = await browser.evaluate(readAtlasSix);
  for (const page of ATLAS_PAGES) {
    const source = atlasSixSource(page.id);
    await app.open('/fr/symboles/' + page.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const wide = await browser.evaluate(readAtlasSix);
    // About 90 % of 2560 px, the index beside the plate, the reading beside the list.
    expect(wide.overflow).toBe(false);
    expect(wide.article!.width).toBeGreaterThanOrEqual(wide.viewport.width * 0.88);
    expect(wide.rail!.right).toBeLessThanOrEqual(wide.list!.left);
    expect(wide.reflection!.left).toBeGreaterThanOrEqual(wide.list!.right);
    expect(wide.reflection!.top).toBeLessThan(wide.list!.bottom);
    expect(wide.colours).toEqual(tiger.colours);
    // The cut-out side illustration beside the meaning, the scene thumbnails clear of their labels.
    expect(wide.plate).toBe('plate');
    expect(wide.decor!.left).toBeGreaterThanOrEqual(wide.reading!.right);
    expect(wide.thumbsClear).toEqual([true, true, true]);
    // Every paragraph (journal example and method included), card, question and answer.
    expect(wide.counts).toEqual({
      opening: 1, continuation: source.paragraphs.length - 1, variations: source.variations.length,
      questions: source.questions, faq: source.faq, faqSchema: source.faq, thumbnails: 3,
    });
    source.paragraphs.forEach((paragraph, index) => {
      expect(wide.zones[index ? 'lecture' : 'meaning'].includes(paragraph), `${page.id} paragraph ${index + 1} is whole`).toBe(true);
    });
    source.variations.forEach(meaning => expect(wide.zones.variations.includes(meaning)).toBe(true));
    expectSixScene(wide, page.scenes[0]);
    await app.screenshot('atlas-six-' + page.id + '-2560');

    // Mouse on the second choice, then the arrow keys of the native radio group, round to the first.
    const radios = screen.getByRole('radio');
    const second = await browser.evaluate(() => document.querySelectorAll('.atlas-scene-label')[1].textContent!.trim());
    await screen.getByText(second, { exact: true }).first().tap(); // the label precedes its variation card
    await expect(radios.nth(1)).toBeChecked();
    expectSixScene(await browser.evaluate(readAtlasSix), page.scenes[1]);
    await radios.nth(1).press('ArrowDown');
    await expect(radios.nth(2)).toBeChecked();
    expectSixScene(await browser.evaluate(readAtlasSix), page.scenes[2]);
    await radios.nth(2).press('ArrowDown');
    await expect(radios.nth(0)).toBeChecked();
    expectSixScene(await browser.evaluate(readAtlasSix), page.scenes[0]);
  }
});

const ATLAS_SIX_PAUSE = 'Pause des animations des illustrations';

// Every painting of the page (hero, side illustration, thumbnails): its state, and for each
// effect of the scene it shows, its channel, its texture (decoded, with visible pixels where the
// page shows it) and its current opacity and transform.
function readSurfaces() {
  return Array.from(document.querySelectorAll<HTMLElement>('.symbol-hero, [data-living-surface]')).map(node => {
    const layers = Array.from(node.querySelectorAll<HTMLElement>('.slp-scene'))
      .filter(scene => getComputedStyle(scene).display !== 'none')
      .flatMap(scene => Array.from(scene.querySelectorAll<HTMLElement>('.slp-l')));
    // The texture's visible pixels: as rendered now (its motion included), cut to every box that clips
    // it up to the surface (its layer, the stage on the painted frame, the frame of a thumbnail), and on
    // a masked stage (the side illustration) kept only where the painting's own alpha lets it through.
    // A texture moved off the frame or into a hole of the mask counts none.
    const opaque = (texture: HTMLImageElement | null) => {
      if (!texture || !texture.naturalWidth) return 0;
      const drawn = texture.getBoundingClientRect();
      const clip = { left: drawn.left, top: drawn.top, right: drawn.right, bottom: drawn.bottom };
      for (let box = texture.parentElement; box && box !== node.parentElement; box = box.parentElement) {
        const style = getComputedStyle(box), r = box.getBoundingClientRect();
        if (style.overflowX !== 'visible') [clip.left, clip.right] = [Math.max(clip.left, r.left), Math.min(clip.right, r.right)];
        if (style.overflowY !== 'visible') [clip.top, clip.bottom] = [Math.max(clip.top, r.top), Math.min(clip.bottom, r.bottom)];
      }
      if (clip.right - clip.left < 1 || clip.bottom - clip.top < 1) return 0;
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = Math.max(8, Math.round(96 * (clip.bottom - clip.top) / (clip.right - clip.left)));
      const context = canvas.getContext('2d')!;
      const scaleX = canvas.width / (clip.right - clip.left), scaleY = canvas.height / (clip.bottom - clip.top);
      const paint = (image: HTMLImageElement, r: DOMRect) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (r.left - clip.left) * scaleX, (r.top - clip.top) * scaleY, r.width * scaleX, r.height * scaleY);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const pixels = paint(texture, drawn);
      // The mask is the painting stretched over the stage (mask-size: 100% 100%).
      const stage = texture.closest('.slp-stage');
      const painting = node.querySelector<HTMLImageElement>('img:not(.slp-t)');
      const mask = stage?.classList.contains('slp-stage--masked') && painting ? paint(painting, stage.getBoundingClientRect()) : null;
      let count = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 8 && (!mask || mask[index] > 8)) count += 1;
      return count;
    };
    return {
      name: node.dataset.livingSurface ?? 'hero',
      living: node.dataset.living ?? null,
      state: node.dataset.livingMotionState ?? null,
      reasons: (node.dataset.livingMotionReasons ?? '').split(' ').filter(Boolean),
      channels: layers.map(layer => layer.dataset.livingChannel ?? ''),
      textures: layers.map(layer => layer.querySelector<HTMLImageElement>('img.slp-t')?.currentSrc.replace(/^.*\//, '') ?? ''),
      opaque: layers.map(layer => opaque(layer.querySelector<HTMLImageElement>('img.slp-t'))),
      frames: layers.map(layer => { const style = getComputedStyle(layer.querySelector('.slp-t')!); return style.opacity + ' ' + style.transform; }),
      // How far each texture's drawn ratio departs from its own (0: never stretched).
      stretch: layers.map(layer => {
        const texture = layer.querySelector<HTMLImageElement>('img.slp-t');
        const drawn = texture?.getBoundingClientRect();
        if (!texture || !drawn || !drawn.height || !texture.naturalHeight) return 1;
        return Math.abs(drawn.width / drawn.height / (texture.naturalWidth / texture.naturalHeight) - 1);
      }),
    };
  });
}

const surfaceNamed = (all: Awaited<ReturnType<typeof readSurfaces>>, name: string) => all.find(surface => surface.name === name)!;

test('the French atlas paintings each move two distinct raster effects, only on screen, and stop by themselves off screen or with reduced motion, without a pause control', { timeout: 300_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 1920, height: 1080 });
  for (const page of ATLAS_PAGES) {
    await app.open('/fr/symboles/' + page.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    // The previous page ends in reduced motion: the live preference returns to none once this
    // page is open (only routes and the viewport are set before the first open).
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    const config = await browser.evaluate(readAtlasSix).then(read => read.config);
    expect(config?.surfaces.map(surface => surface.name), `${page.id}: every painting has its two effects`).toEqual(['hero', 'plate', ...page.scenes.map(scene => 'scene-' + scene)]);
    // Explicit texture ids: on every painting, channel a is this page's own layer and channel b its own accent.
    for (const surface of config!.surfaces) {
      for (const [scene, { layers }] of Object.entries(surface.scenes)) {
        expect(layers.map(layer => [layer.channel, layer.src.replace(/-\d+-[0-9a-f]{12}\.\w+$/, '')]), `${page.id} ${surface.name} ${scene}`)
          .toEqual([['a', `/img/symbols/atlas-six-v2/${page.id}/layer`], ['b', `/img/symbols/atlas-six-v2/${page.id}/accent`]]);
      }
    }

    // A painting on screen runs both effects: two channels, two different decoded textures with
    // visible pixels, each actually changing.
    const expectLiving = async (name: string) => {
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, name).living, surfaceNamed(all, name).state]), { timeout: 15_000 }).toEqual(['ready', 'running']);
      const first = surfaceNamed(await browser.evaluate(readSurfaces), name);
      expect(first.channels, `${page.id} ${name}`).toEqual(['a', 'b']);
      expect(first.textures[0]).not.toBe(first.textures[1]);
      expect(first.opaque.every(count => count > 0), `${page.id} ${name}: both textures have visible pixels`).toBe(true);
      expect(first.stretch.every(gap => gap < 0.01), `${page.id} ${name}: both textures keep their ratio`).toBe(true);
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, name).frames.map((frame, index) => frame !== first.frames[index]))).toEqual([true, true]);
    };

    await expectLiving('hero');
    const hero = await browser.evaluate(readAtlasSix);
    expect(hero.scene).toBe('landscape');
    expect(hero.src.includes(config!.surfaces[0].scenes.landscape.match)).toBe(true);
    expect(hero.properties.every(property => property === 'opacity' || property === 'transform')).toBe(true);
    expect(hero.unbalanced).toEqual([]);
    expect([hero.paintingAnimations, hero.figureShift]).toEqual([0, 0]);
    // Measured depth: the painting follows a fixed share of the scroll, never zoomed.
    const down = 300;
    expect(await browser.evaluate(scrollToY, down)).toBe(down);
    await expect.poll(() => browser.evaluate(readAtlasSix).then(read => Math.abs(read.figureShift - down * config!.surfaces[0].depth!) <= 0.5)).toBe(true);

    // The side illustration beside the meaning, then the thumbnails: each runs on its own while the
    // hero, scrolled away, rests.
    await browser.evaluate(() => { document.querySelector('[data-living-surface="plate"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    await expectLiving('plate');
    await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    for (const scene of page.scenes) await expectLiving('scene-' + scene);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').state, surfaceNamed(all, 'hero').reasons])).toEqual(['paused', ['offscreen']]);
    expect((await browser.evaluate(readAtlasSix)).thumbsClear).toEqual([true, true, true]);
    await app.screenshot('atlas-six-' + page.id + '-scenes-1920');

    // No pause control (owner decision) on any painting or group of paintings.
    expect(await browser.evaluate(() => document.querySelectorAll('.symbol-hero button, [data-living-surface] button, .atlas-scenes button, .slp-toggle').length)).toBe(0);
    expect(await screen.getByRole('button', { name: ATLAS_SIX_PAUSE }).count()).toBe(0);
    // Back at the top the hero runs again, and the thumbnails, now off screen, stop.
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, 'hero').state, ...page.scenes.map(scene => surfaceNamed(all, 'scene-' + scene).reasons.join(' '))]))
      .toEqual(['running', 'offscreen', 'offscreen', 'offscreen']);

    // A live reduced-motion preference stops every painting; back to none, the hero on screen runs again.
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [...new Set(all.map(surface => surface.state))])).toEqual(['reduced']);
    expect((await browser.evaluate(readAtlasSix)).playStates).toEqual([]);
    await app.screenshot('atlas-six-' + page.id + '-reduced-1920');
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').state)).toBe('running');
  }
  await browser.emulateMedia({ reducedMotion: 'no-preference' });
  // A symbol without a pack reads in the same article, as wide, without scenes, side illustration or
  // motion script (nor its request): its questions sit where a pack shows its illustration.
  await app.open('/en/symbols/deer.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const plain = await browser.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
    };
    return {
      packParts: document.querySelectorAll('.atlas-scene-input, .atlas-decor, article.max-w-3xl, script[src*="symbol-living"], #symbol-living-config').length,
      motionRequests: performance.getEntriesByType('resource').filter(entry => /symbol-living|tiger-living/.test(entry.name)).length,
      article: box('article.atlas'), reading: box('.atlas-reading'), questions: box('.atlas-plate > #questions'),
      viewport: document.documentElement.clientWidth,
    };
  });
  expect([plain.packParts, plain.motionRequests]).toEqual([0, 0]);
  expect(plain.article.width).toBeGreaterThanOrEqual(plain.viewport * 0.88);
  expect(plain.questions.left).toBeGreaterThanOrEqual(plain.reading.right);
  expect(plain.questions.top).toBeLessThan(plain.reading.bottom);
  await app.screenshot('symbol-deer-1920');
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
    expect(config?.surfaces.map(surface => surface.name), path).toEqual(['hero', 'plate', ...TIGER_SCENES.map(scene => 'scene-' + scene)]);
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
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [...new Set(all.map(surface => surface.state))])).toEqual(['reduced']);
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
    // Landscape keeps the 16:9 contain hero; portrait takes 75svh with cover.
    if (scene === 'landscape') expect(read.hero.width / read.hero.height).toBeCloseTo(16 / 9, 2);
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

test('a scene thumbnail that failed before its effects start keeps its choice, and the other paintings keep running', { timeout: 120_000 }, async ({ app, browser, screen }) => {
  // Thumbnails are lazy: the browser fetches one (here, refused) well before it comes near enough
  // for its effects to start, which then find an image that has already failed.
  const page = ATLAS_PAGES[0];
  const broken = 'scene-' + page.scenes[0];
  await browser.setViewport({ width: 1920, height: 1080 });
  await browser.route('**/img/symbols/atlas-six-v2/' + page.id + '/' + broken + '-*', route => route.fulfill({ status: 404, body: '' }));
  await app.open('/fr/symboles/' + page.slug + '.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const thumb = (name: string) => browser.evaluate((selector: string) => {
    const node = document.querySelector<HTMLElement>(selector)!;
    const img = node.querySelector('img')!;
    return { living: node.getAttribute('data-living'), failed: img.complete && img.naturalWidth === 0, stages: node.querySelectorAll('.slp-stage').length };
  }, `[data-living-surface="${name}"]`);
  await expect.poll(() => thumb(broken).then(read => [read.failed, read.living]), { timeout: 15_000 }).toEqual([true, null]);

  await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
  await expect.poll(() => thumb(broken).then(read => [read.living, read.stages]), { timeout: 15_000 }).toEqual(['off', 0]);
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => page.scenes.slice(1).map(scene => surfaceNamed(all, 'scene-' + scene).state)), { timeout: 15_000 }).toEqual(['running', 'running']);
  // The choice still works from the keyboard and the mouse.
  const radios = screen.getByRole('radio');
  await radios.nth(0).press('ArrowDown');
  await expect(radios.nth(1)).toBeChecked();
  const first = await browser.evaluate(() => document.querySelectorAll('.atlas-scene-label')[0].textContent!.trim());
  await screen.getByText(first, { exact: true }).first().tap();
  await expect(radios.nth(0)).toBeChecked();
  expectSixScene(await browser.evaluate(readAtlasSix), page.scenes[0]);
  await app.screenshot('atlas-six-' + page.id + '-broken-thumbnail-1920');
});

test('on a phone the French atlas heroes take 75svh from the top, behind a navbar that gains a ground past them', { timeout: 300_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  for (const page of ATLAS_PAGES) {
    await app.open('/fr/symboles/' + page.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => browser.evaluate(readAtlasSix).then(read => read.living), { timeout: 15_000 }).toBe('ready');
    const phone = await browser.evaluate(readAtlasSix);
    expect([phone.hero.top, phone.overflow, phone.objectFit]).toEqual([0, false, 'cover']);
    expect(phone.hero.height).toBeCloseTo(844 * 0.75, 0);
    // The dedicated portrait painting with its two effects, never cropped sideways beyond 1 %.
    expect(phone.src).toMatch(new RegExp('/atlas-six-v2/' + page.id + '/portrait-[0-9]+-[0-9a-f]{12}\\.(?:avif|webp)$'));
    expect(phone.painted).toBeLessThanOrEqual(phone.viewport.width * 1.01);
    expect(phone.scene).toBe('portrait');
    const portrait = surfaceNamed(await browser.evaluate(readSurfaces), 'hero');
    expect(portrait.channels).toEqual(['a', 'b']);
    expect(portrait.stretch.every(gap => gap < 0.01), `${page.id}: the portrait's textures keep their ratio`).toBe(true);
    expect(phone.navGround).toBe('rgba(0, 0, 0, 0)');
    await app.screenshot('atlas-six-' + page.id + '-390');
    expect(await browser.evaluate(scrollToY, 900)).toBe(900);
    await expect.poll(() => browser.evaluate(readAtlasSix).then(read => read.navGround)).toMatch(/^rgba\(10, 5, 20, 0\.9\d*\)$/);
    // The thumbnails run below; the side illustration is neither shown nor fetched on a phone.
    await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => page.scenes.map(scene => surfaceNamed(all, 'scene-' + scene).state)), { timeout: 15_000 }).toEqual(['running', 'running', 'running']);
    expect(await browser.evaluate(() => [
      document.querySelector('[data-living-surface="plate"]')!.hasAttribute('data-living'),
      performance.getEntriesByType('resource').filter(entry => entry.name.includes('/plate-')).length,
    ])).toEqual([false, 0]);
    expect(await browser.evaluate(scrollToY, 0)).toBe(0);

    // Opened at #scenes, the scenes' title sits below the fixed navbar and section bar, and no pause
    // control is mounted there.
    await app.open('/fr/symboles/' + page.slug + '.html#scenes');
    await expect.poll(() => browser.evaluate(() => {
      const covers = ['#navbar', '.symbol-jump-nav'].map(selector => document.querySelector(selector)!.getBoundingClientRect())
        .filter(rect => rect.height > 0 && rect.bottom > 0).map(rect => rect.bottom);
      const below = Math.max(0, ...covers);
      const title = document.querySelector('#atlas-scenes-title')!.getBoundingClientRect();
      const hit = document.elementFromPoint(title.left + 8, title.top + title.height / 2);
      return { title: title.top >= below && title.bottom <= innerHeight, hit: Boolean(hit && hit.closest('#atlas-scenes-title')), controls: document.querySelectorAll('.atlas-scenes button, .slp-toggle').length };
    }), { timeout: 15_000 }).toEqual({ title: true, hit: true, controls: 0 });
  }
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
    tag: 'de', chosen: 'Ihre Szene: ', source: 'Variante lesen „',
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
  await screen.getByRole('radio', { name: /^Lua nova ou lua escura/ }).press('ArrowUp');
  await expect(screen.getByRole('radio', { name: /^Lua cheia/ })).toBeChecked();
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

test('a page without an atlas, a missing FAQ or a thumbnail that fails stays in the page\'s language', { timeout: 120_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  // A symbol without a pack: the same article, in Portuguese, linking only to pt-br pages.
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

// Missing-symbol work package: the literal list stays independent of the activation config.
// These journeys catch a decoded-but-wrong portrait, a transparent rectangle, an effect placed
// entirely outside a crop, a scene with the wrong editorial reading, and a moving base painting.
const NEW_SYMBOL_PACKS = [
  {"id": "light", "slug": "lumiere", "name": "Lumière", "scenes": ["a-light-switch-that-does-nothing", "a-light-going-out", "a-blinding-light"]},
  {"id": "lighthouse", "slug": "phare", "name": "Phare", "scenes": ["a-lighthouse-beam-sweeping-the-night", "a-lighthouse-that-goes-dark", "seeing-a-lighthouse-from-a-boat-in-a-s"]},
  {"id": "window", "slug": "fenetre", "name": "Fenêtre", "scenes": ["looking-out-of-a-window", "someone-at-the-window", "a-window-that-will-not-close"]},
  {"id": "train-station", "slug": "gare", "name": "Gare", "scenes": ["missing-the-train", "waiting-on-a-platform", "the-wrong-platform-or-the-wrong-train"]},
  {"id": "wall", "slug": "mur", "name": "Mur", "scenes": ["a-wall-blocking-your-way", "climbing-over-a-wall", "a-crumbling-or-collapsing-wall"]},
  {"id": "library", "slug": "bibliotheque", "name": "Bibliothèque", "scenes": ["searching-for-a-book-you-cannot-find", "an-endless-library", "a-silent-library-at-night"]},
  {"id": "neighbor", "slug": "voisin", "name": "Voisin", "scenes": ["an-argument-with-a-neighbor", "a-neighbor-coming-into-your-home", "a-friendly-or-helpful-neighbor"]},
  {"id": "hallway", "slug": "couloir", "name": "Couloir", "scenes": ["an-endless-hallway", "doors-on-both-sides", "a-dark-hallway-at-night"]},
  {"id": "city", "slug": "ville", "name": "Ville", "scenes": ["an-unknown-city", "being-lost-in-a-city", "a-city-at-night"]},
  {"id": "street", "slug": "rue", "name": "Rue", "scenes": ["an-empty-street-at-night", "a-busy-crowded-street", "the-street-where-you-grew-up"]},
  {"id": "tunnel", "slug": "tunnel", "name": "Tunnel", "scenes": ["a-dark-tunnel", "light-at-the-end-of-the-tunnel", "a-tunnel-that-narrows"]},
  {"id": "maze", "slug": "labyrinthe", "name": "Labyrinthe", "scenes": ["lost-in-a-maze-with-no-way-out", "a-hedge-maze-or-garden-maze", "a-maze-of-corridors-or-rooms"]},
  {"id": "tower", "slug": "tour", "name": "Tour", "scenes": ["climbing-a-tower-or-endless-stairs", "stuck-at-the-top-of-a-tower", "a-tower-collapsing-or-leaning"]},
  {"id": "wind", "slug": "vent", "name": "Vent", "scenes": ["a-strong-wind-pushing-you-back", "being-lifted-by-the-wind", "wind-blowing-through-the-house"]},
  {"id": "fog", "slug": "brouillard", "name": "Brouillard", "scenes": ["driving-in-fog", "being-lost-in-fog", "someone-appearing-out-of-the-fog"]},
  {"id": "ice", "slug": "glace", "name": "Glace / Gel", "scenes": ["thin-ice-cracking-under-you", "falling-through-the-ice", "slipping-or-unable-to-stand-on-ice"]},
  {"id": "clouds", "slug": "nuages", "name": "Nuages", "scenes": ["white-clouds-drifting-in-a-blue-sky", "dark-clouds-gathering", "walking-or-lying-on-clouds"]},
  {"id": "waves", "slug": "vagues", "name": "Vagues", "scenes": ["watching-huge-waves-from-the-shore", "being-knocked-over-by-a-wave", "a-wave-about-to-break-over-you"]},
  {"id": "outer-space", "slug": "espace", "name": "Espace / Planètes", "scenes": ["floating-weightless-in-space", "travelling-to-another-planet", "seeing-the-earth-from-far-away"]},
  {"id": "burglar", "slug": "cambrioleur", "name": "Voleur / Cambrioleur", "scenes": ["hearing-a-burglar-in-the-house-at-nigh", "being-robbed", "hiding-from-a-burglar"]},
  {"id": "royalty", "slug": "roi-reine", "name": "Roi / Reine", "scenes": ["meeting-a-king-or-queen", "being-crowned-king-or-queen", "a-king-or-queen-giving-you-an-order"]},
  {"id": "crowd", "slug": "foule", "name": "Foule", "scenes": ["being-lost-in-a-crowd", "a-crowd-staring-at-you", "speaking-or-performing-in-front-of-a-c"]},
  {"id": "twins", "slug": "jumeaux", "name": "Jumeaux", "scenes": ["being-pregnant-with-twins", "having-a-twin-you-never-had", "seeing-identical-twins"]},
  {"id": "dragon", "slug": "dragon", "name": "Dragon", "scenes": ["a-dragon-attacking-or-chasing-you", "fighting-or-slaying-a-dragon", "riding-or-flying-on-a-dragon"]},
  {"id": "unicorn", "slug": "licorne", "name": "Licorne", "scenes": ["seeing-a-unicorn", "riding-a-unicorn", "a-wounded-black-or-dark-unicorn"]},
  {"id": "fox", "slug": "renard", "name": "Renard", "scenes": ["a-fox-crossing-the-road", "a-fox-watching-you", "a-fox-biting-or-attacking-you"]},
  {"id": "fly", "slug": "mouche", "name": "Mouche", "scenes": ["a-swarm-of-flies", "killing-a-fly", "flies-on-food"]},
  {"id": "jellyfish", "slug": "meduse", "name": "Méduse", "scenes": ["being-stung-by-a-jellyfish", "swimming-among-many-jellyfish", "a-glowing-jellyfish-in-the-dark"]},
  {"id": "octopus", "slug": "pieuvre", "name": "Pieuvre / Poulpe", "scenes": ["tentacles-wrapping-around-you", "an-octopus-watching-you", "a-cloud-of-ink"]},
  {"id": "broken-glass", "slug": "verre-brise", "name": "Verre brisé", "scenes": ["walking-on-broken-glass", "breaking-a-glass-yourself", "glass-in-your-mouth"]},
  {"id": "gift", "slug": "cadeau", "name": "Cadeau", "scenes": ["receiving-an-unexpected-gift", "opening-an-empty-box", "a-gift-from-someone-who-has-died"]},
  {"id": "bag", "slug": "sac", "name": "Sac / Sac à main", "scenes": ["losing-your-bag", "a-stolen-bag", "a-bag-that-is-too-heavy"]},
  {"id": "explosion", "slug": "explosion", "name": "Explosion / Bombe", "scenes": ["a-sudden-explosion-out-of-nowhere", "a-bomb-you-have-to-defuse", "an-explosion-in-the-house"]},
  {"id": "searching", "slug": "chercher", "name": "Chercher quelque chose", "scenes": ["looking-for-your-keys-or-your-phone", "looking-for-your-car-in-a-car-park", "searching-and-never-finding"]},
  {"id": "driving", "slug": "conduire", "name": "Conduire / Perdre le contrôle", "scenes": ["brakes-that-stop-working", "driving-without-a-licence-or-without-k", "someone-else-grabbing-the-wheel"]},
  {"id": "climbing", "slug": "grimper", "name": "Grimper", "scenes": ["climbing-a-mountain", "climbing-a-ladder", "never-reaching-the-top"]},
  {"id": "breakup", "slug": "rupture", "name": "Rupture", "scenes": ["being-left-by-your-current-partner", "breaking-up-with-your-partner", "an-ex-breaking-up-with-you-again"]},
  {"id": "stage", "slug": "etre-sur-scene", "name": "Être sur scène", "scenes": ["forgetting-your-lines-on-stage", "stage-fright-before-going-on", "performing-without-rehearsing"]},
  {"id": "clock", "slug": "horloge", "name": "Horloge", "scenes": ["arretee", "aiguilles", "clocher"]},
  {"id": "candle", "slug": "bougie", "name": "Bougie", "scenes": ["seule", "anniversaire", "ceremonie"]},
] as const;

for (const page of NEW_SYMBOL_PACKS) {
  test('new symbol packs: ' + page.id + ' renders every surface and its two effects', { timeout: 180_000 }, async ({ app, browser, screen }) => {
    await browser.setViewport({ width: 2560, height: 1440 });
    await app.open('/fr/symboles/' + page.slug + '.html');
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(screen.getByRole('heading', { level: 1 })).toHaveText(page.name);
    // Keep the art review clear of the consent banner, using the real opt-out control.
    if (await browser.evaluate(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Continuer sans mesure'))) {
      await screen.getByRole('button', { name: 'Continuer sans mesure', exact: true }).tap();
    }
    const moving = async (name: string) => {
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => {
        const s = surfaceNamed(all, name);
        return s && [s.living, s.state];
      })).toEqual(['ready', 'running']);
      const start = surfaceNamed(await browser.evaluate(readSurfaces), name);
      expect(start.channels).toEqual(['a', 'b']);
      expect(start.textures[0]).not.toBe(start.textures[1]);
      expect(start.opaque.every(count => count > 0)).toBe(true);
      expect(start.stretch.every(gap => gap < 0.01)).toBe(true);
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, name).frames.map((frame, i) => frame !== start.frames[i]))).toEqual([true, true]);
    };
    await moving('hero');
    const wide = await browser.evaluate(readAtlasSix);
    expect(wide.src).toContain('/' + page.id + '/hero-');
    expect(wide.overflow).toBe(false);
    expect(wide.paintingAnimations).toBe(0);
    expect(wide.hero.top).toBe(0);
    expect(wide.hero.width).toBe(2560);
    await app.screenshot('pack-' + page.id + '-2560-hero');

    for (const name of ['plate', ...page.scenes.map(scene => 'scene-' + scene)]) {
      await browser.evaluate((surface: string) => {
        document.querySelector('[data-living-surface="' + surface + '"]')!.scrollIntoView({ block: 'center', behavior: 'instant' });
        return window.scrollY;
      }, name);
      await moving(name);
      if (name === 'plate') await app.screenshot('pack-' + page.id + '-2560-plate');
    }
    for (const scene of page.scenes) {
      const label = await browser.evaluate((id: string) => document.querySelector('label[for="atlas-scene-' + id + '"] .atlas-scene-label')!.textContent!.trim(), scene);
      await screen.getByText(label, { exact: true }).first().tap();
      expectSixScene(await browser.evaluate(readAtlasSix), scene);
    }
    await app.screenshot('pack-' + page.id + '-2560-scenes');
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => [...new Set(all.map(s => s.state))])).toEqual(['reduced']);

    await browser.setViewport({ width: 390, height: 844 });
    await app.open('/fr/symboles/' + page.slug + '.html');
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await moving('hero');
    const phone = await browser.evaluate(readAtlasSix);
    expect(phone.src).toContain('/' + page.id + '/portrait-');
    expect(phone.hero.top).toBe(0);
    expect(phone.hero.height).toBeCloseTo(844 * 0.75, 0);
    expect(phone.overflow).toBe(false);
    expect(await browser.evaluate(() => performance.getEntriesByType('resource').some(e => /\/plate-[0-9]+-/.test(e.name)))).toBe(false);
    await app.screenshot('pack-' + page.id + '-390-hero');
    await app.open('/fr/symboles/' + page.slug + '.html#scenes');
    await expect(screen.getByRole('heading', { name: 'Scènes courantes', exact: true })).toBeVisible();
    await expect.poll(() => browser.evaluate(() => {
      const covers = ['#navbar', '.symbol-jump-nav'].map(selector => document.querySelector(selector)!.getBoundingClientRect())
        .filter(rect => rect.height > 0 && rect.bottom > 0).map(rect => rect.bottom);
      const title = document.querySelector('#atlas-scenes-title')!.getBoundingClientRect();
      const hit = document.elementFromPoint(title.left + 8, title.top + title.height / 2);
      return title.top >= Math.max(0, ...covers) && title.bottom <= innerHeight && Boolean(hit?.closest('#atlas-scenes-title'));
    }), { timeout: 15_000 }).toBe(true);
    for (const scene of page.scenes) await moving('scene-' + scene);
    await app.screenshot('pack-' + page.id + '-390-scenes');

    const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')).symbols.find((s: {id: string}) => s.id === page.id);
    const paths: Record<string,string> = { en: 'symbols', es: 'simbolos', de: 'traumsymbole', it: 'simboli', 'pt-br': 'simbolos' };
    for (const [lang, route] of Object.entries(paths)) {
      const content = catalog[lang === 'pt-br' ? 'pt' : lang];
      for (const viewport of [{ width: 2560, height: 1440 }, { width: 390, height: 844 }]) {
        await browser.setViewport(viewport);
        await app.open('/' + lang + '/' + route + '/' + content.slug + '.html');
        await expect(screen.getByRole('heading', { level: 1 })).toHaveText(content.name);
        await expect.poll(() => browser.evaluate(() => {
          const img = document.querySelector<HTMLImageElement>('.symbol-hero img');
          return Boolean(img?.complete && img.naturalWidth && document.querySelectorAll('.atlas-scene-input').length === 3);
        })).toBe(true);
        const localized = await browser.evaluate(readAtlasSix);
        expect(localized.src).toContain('/' + page.id + '/' + (viewport.width === 390 ? 'portrait-' : 'hero-'));
        expect(localized.overflow).toBe(false);
        expectSixScene(localized, page.scenes[0]);
      }
    }
  });
}

// Lot 08 (owner request 2026-10-20): six packs on the common engine, listed here independently of the
// configuration. In each of the six languages every painting (hero, side illustration, three scenes)
// moves its two effects, the title is the symbol's name alone and each scene shows its published card;
// on a phone the hero takes 75svh from the top with the dedicated portrait painting.
const SYMBOL_PATHS: Record<string, string> = { fr: 'symboles', en: 'symbols', es: 'simbolos', de: 'traumsymbole', it: 'simboli', 'pt-br': 'simbolos' };
const LOT_08_PACKS: { id: string; scenes: string[]; pages: Record<string, [string, string]> }[] = [
  { id: 'owl', scenes: ['regard', 'cri', 'blanc'], pages: { fr: ['hibou', 'Hibou'], en: ['owl', 'Owl'], es: ['buho', 'Búho'], de: ['eule', 'Eule'], it: ['gufo', 'Gufo'], 'pt-br': ['coruja', 'Coruja'] } },
  { id: 'boat', scenes: ['calme', 'tempete', 'naufrage'], pages: { fr: ['bateau', 'Bateau'], en: ['boat', 'Boat'], es: ['barco', 'Barco'], de: ['boot', 'Boot'], it: ['barca', 'Barca'], 'pt-br': ['barco', 'Barco'] } },
  { id: 'cave', scenes: ['abri', 'bloquee', 'exploration'], pages: { fr: ['grotte', 'Grotte'], en: ['cave', 'Cave'], es: ['cueva', 'Cueva'], de: ['hohle', 'Höhle'], it: ['grotta', 'Grotta'], 'pt-br': ['caverna', 'Caverna'] } },
  { id: 'rose', scenes: ['rouge', 'fanee', 'epine'], pages: { fr: ['rose', 'Rose'], en: ['rose', 'Rose'], es: ['rosa', 'Rosa'], de: ['rose', 'Rose'], it: ['rosa', 'Rosa'], 'pt-br': ['rosa', 'Rosa'] } },
  { id: 'lightning', scenes: ['lointain', 'arbre', 'abri'], pages: { fr: ['eclair', 'Éclair'], en: ['lightning', 'Lightning'], es: ['rayo', 'Rayo'], de: ['blitz', 'Blitz'], it: ['fulmine', 'Fulmine'], 'pt-br': ['raio', 'Raio'] } },
  { id: 'whale', scenes: ['proche', 'echouee', 'saut'], pages: { fr: ['baleine', 'Baleine'], en: ['whale', 'Whale'], es: ['ballena', 'Ballena'], de: ['wal', 'Wal'], it: ['balena', 'Balena'], 'pt-br': ['baleia', 'Baleia'] } },
];

for (const pack of LOT_08_PACKS) {
  test('lot 08: ' + pack.id + ' moves two effects on its hero, side illustration and three scenes in the six languages, and takes 75svh on a phone', { timeout: 300_000 }, async ({ app, browser, screen }) => {
    const pathOf = (lang: string) => `/${lang}/${SYMBOL_PATHS[lang]}/${pack.pages[lang][0]}.html`;
    // A painting on screen runs both effects: two channels, two different decoded textures with
    // visible pixels, each actually changing.
    const expectLiving = async (path: string, name: string) => {
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => [surfaceNamed(all, name).living, surfaceNamed(all, name).state]), { timeout: 15_000 }).toEqual(['ready', 'running']);
      const first = surfaceNamed(await browser.evaluate(readSurfaces), name);
      expect(first.channels, `${path} ${name}`).toEqual(['a', 'b']);
      expect(first.textures[0]).not.toBe(first.textures[1]);
      expect(first.opaque.every(count => count > 0), `${path} ${name}: both textures have visible pixels`).toBe(true);
      expect(first.stretch.every(gap => gap < 0.01), `${path} ${name}: both textures keep their ratio`).toBe(true);
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, name).frames.map((frame, index) => frame !== first.frames[index]))).toEqual([true, true]);
    };

    await browser.setViewport({ width: 1920, height: 1080 });
    for (const lang of Object.keys(pack.pages)) {
      const path = pathOf(lang);
      await app.open(path);
      // The previous page ends in reduced motion: the live preference returns to none once this page is open.
      await browser.emulateMedia({ reducedMotion: 'no-preference' });
      // The symbol's name alone, without a "Meaning" label, in every language.
      await expect(screen.getByRole('heading', { level: 1 })).toHaveText(pack.pages[lang][1]);
      const config = await browser.evaluate(readAtlasSix).then(read => read.config);
      expect(config?.surfaces.map(surface => surface.name), path).toEqual(['hero', 'plate', ...pack.scenes.map(scene => 'scene-' + scene)]);
      // On every painting, channel a is this pack's own layer and channel b its own accent.
      for (const surface of config!.surfaces) {
        for (const [scene, { layers }] of Object.entries(surface.scenes)) {
          expect(layers.map(layer => [layer.channel, layer.src.replace(/-\d+-[0-9a-f]{12}\.\w+$/, '')]), `${path} ${surface.name} ${scene}`)
            .toEqual([['a', `/img/symbols/atlas-six-v2/${pack.id}/layer`], ['b', `/img/symbols/atlas-six-v2/${pack.id}/accent`]]);
        }
      }

      await expectLiving(path, 'hero');
      const wide = await browser.evaluate(readAtlasSix);
      expect([wide.scene, wide.src.includes('/' + pack.id + '/hero-'), wide.overflow, wide.paintingAnimations]).toEqual(['landscape', true, false, 0]);
      await browser.evaluate(() => { document.querySelector('[data-living-surface="plate"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
      await expectLiving(path, 'plate');
      await browser.evaluate(() => { document.querySelector('.atlas-scene-list')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
      for (const scene of pack.scenes) await expectLiving(path, 'scene-' + scene);
      expect((await browser.evaluate(readAtlasSix)).thumbsClear).toEqual([true, true, true]);
      // Each scene, chosen from its label, shows its published variation card whole.
      for (const scene of pack.scenes) {
        const label = await browser.evaluate((id: string) => document.querySelector('label[for="atlas-scene-' + id + '"] .atlas-scene-label')!.textContent!.trim(), scene);
        await screen.getByText(label, { exact: true }).first().tap();
        expectSixScene(await browser.evaluate(readAtlasSix), scene);
      }
      await app.screenshot('lot08-' + pack.id + '-' + lang + '-1920-scenes');
      // No pause control on any painting; reduced motion stops them all.
      expect(await browser.evaluate(() => document.querySelectorAll('.symbol-hero button, [data-living-surface] button, .atlas-scenes button, .slp-toggle').length)).toBe(0);
      await browser.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(() => browser.evaluate(readSurfaces).then(all => [...new Set(all.map(surface => surface.state))])).toEqual(['reduced']);
    }

    await browser.setViewport({ width: 390, height: 844 });
    for (const lang of Object.keys(pack.pages)) {
      const path = pathOf(lang);
      await app.open(path);
      await browser.emulateMedia({ reducedMotion: 'no-preference' });
      await expectLiving(path, 'hero');
      const phone = await browser.evaluate(readAtlasSix);
      expect([phone.hero.top, phone.overflow, phone.objectFit, phone.scene], path).toEqual([0, false, 'cover', 'portrait']);
      expect(phone.hero.height).toBeCloseTo(844 * 0.75, 0);
      expect(phone.src).toMatch(new RegExp('/atlas-six-v2/' + pack.id + '/portrait-[0-9]+-[0-9a-f]{12}\\.(?:avif|webp)$'));
      expect(phone.painted).toBeLessThanOrEqual(phone.viewport.width * 1.01);
      // At DPR2 the 390px portrait needs 780 source pixels: its sources offer them. The side
      // illustration is neither shown nor fetched on a phone.
      expect(await browser.evaluate(() => Math.max(...Array.from(document.querySelectorAll('.symbol-hero-media source[media]'))
        .flatMap(source => (source.getAttribute('srcset') ?? '').split(',').map(candidate => Number(candidate.trim().split(' ')[1]?.replace('w', '') ?? 0)))))).toBeGreaterThanOrEqual(780);
      expect(await browser.evaluate(() => performance.getEntriesByType('resource').some(entry => /\/plate-[0-9]+-/.test(entry.name)))).toBe(false);
      if (lang === 'fr') await app.screenshot('lot08-' + pack.id + '-fr-390-hero');
    }
  });
}
