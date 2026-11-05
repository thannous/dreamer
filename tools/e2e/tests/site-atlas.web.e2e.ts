import { readFileSync } from 'node:fs';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ATLAS_SIX_PAUSE, answerAnalytics, expectReducedSurfaces, expectSixScene, mediaPathname, readAtlasSix, readSurfaces, scrollToY, surfaceNamed } from '../site-fixtures';

test.beforeEach(answerAnalytics);

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
    // Every paragraph (method included), card, question and answer.
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

test('the French atlas paintings each move two distinct raster effects, only on screen, and stop by themselves off screen or with reduced motion, without a pause control', { timeout: 300_000 }, async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 1920, height: 1080 });
  for (const page of ATLAS_PAGES) {
    await app.open('/fr/symboles/' + page.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    // The previous page ends in reduced motion: the live preference returns to none once this
    // page is open (only routes and the viewport are set before the first open).
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    const config = await browser.evaluate(readAtlasSix).then(read => read.config);
    expect(config?.surfaces.map(surface => surface.name).sort(), `${page.id}: every painting has its two effects`)
      .toEqual(['hero', 'plate', ...page.scenes.flatMap(scene => ['scene-' + scene, 'scene-' + scene + '-expanded'])].sort());
    // Explicit texture ids: on every painting, channel a is this page's own layer and channel b its own accent.
    for (const surface of config!.surfaces) {
      for (const [scene, { layers }] of Object.entries(surface.scenes)) {
        expect(layers.map(layer => [layer.channel, mediaPathname(layer.src).replace(/-\d+-[0-9a-f]{12}\.\w+$/, '')]), `${page.id} ${surface.name} ${scene}`)
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
    await expectReducedSurfaces(browser);
    expect((await browser.evaluate(readAtlasSix)).playStates).toEqual([]);
    await app.screenshot('atlas-six-' + page.id + '-reduced-1920');
    await browser.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero').state)).toBe('running');
  }
  await browser.emulateMedia({ reducedMotion: 'no-preference' });
  // The completed 240-pack rollout now includes deer. Keep a concrete late-pack
  // counterexample here: treating it as an unillustrated article would hide its
  // side painting, three scenes and common motion engine.
  await app.open('/en/symbols/deer.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'hero')?.state)).toBe('running');
  expect(surfaceNamed(await browser.evaluate(readSurfaces), 'hero').channels).toEqual(['a', 'b']);
  expect(await browser.evaluate(() => document.querySelectorAll('.atlas-decor, .atlas-scene-input').length)).toBe(4);
  await browser.evaluate(() => { document.querySelector('[data-living-surface="plate"]')!.scrollIntoView({ block: 'center', behavior: 'instant' }); return window.scrollY; });
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, 'plate')?.state)).toBe('running');
  expect(surfaceNamed(await browser.evaluate(readSurfaces), 'plate').opaque.every(count => count > 0)).toBe(true);
  await app.screenshot('symbol-deer-complete-pack-1920');
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
