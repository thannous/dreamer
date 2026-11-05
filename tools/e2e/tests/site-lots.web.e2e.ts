import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { answerAnalytics, expectReducedSurfaces, expectSixScene, mediaPathname, readAtlasSix, readSurfaces, surfaceNamed } from '../site-fixtures';

test.beforeEach(answerAnalytics);

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
// Lot 10 (owner request 2026-10-20): the same contract for its six packs, under its own titles and screenshots.
const LOT_10_PACKS: typeof LOT_08_PACKS = [
  { id: 'bee', scenes: ['butinage', 'piqure', 'essaim'], pages: { fr: ['abeille', 'Abeille'], en: ['bee', 'Bee'], es: ['abeja', 'Abeja'], de: ['biene', 'Biene'], it: ['ape', 'Ape'], 'pt-br': ['abelha', 'Abelha'] } },
  { id: 'volcano', scenes: ['endormi', 'eruption', 'lave'], pages: { fr: ['volcan', 'Volcan'], en: ['volcano', 'Volcano'], es: ['volcan', 'Volcán'], de: ['vulkan', 'Vulkan'], it: ['vulcano', 'Vulcano'], 'pt-br': ['vulcao', 'Vulcão'] } },
  { id: 'ring', scenes: ['perdue', 'fiancailles', 'serree'], pages: { fr: ['bague', 'Bague'], en: ['ring', 'Ring'], es: ['anillo', 'Anillo'], de: ['ring', 'Ring'], it: ['anello', 'Anello'], 'pt-br': ['anel', 'Anel'] } },
  { id: 'waterfall', scenes: ['contemplation', 'sous-eau', 'chute'], pages: { fr: ['cascade', 'Cascade'], en: ['waterfall', 'Waterfall'], es: ['cascada', 'Cascada'], de: ['wasserfall', 'Wasserfall'], it: ['cascata', 'Cascata'], 'pt-br': ['cachoeira', 'Cachoeira'] } },
  { id: 'turtle', scenes: ['nage', 'carapace', 'lenteur'], pages: { fr: ['tortue', 'Tortue'], en: ['turtles', 'Turtles'], es: ['tortugas', 'Tortugas'], de: ['schildkroete', 'Schildkröte'], it: ['tartarughe', 'Tartarughe'], 'pt-br': ['tartarugas', 'Tartarugas'] } },
  { id: 'mask', scenes: ['porter', 'colle', 'carnaval'], pages: { fr: ['masque', 'Masque'], en: ['mask', 'Mask'], es: ['mascara', 'Máscara'], de: ['maske', 'Maske'], it: ['maschera', 'Maschera'], 'pt-br': ['mascara', 'Máscara'] } },
];

for (const [lot, shots, pack] of [...LOT_08_PACKS.map(pack => ['lot 09', 'lot08-', pack] as const), ...LOT_10_PACKS.map(pack => ['lot 10', 'lot10-', pack] as const)]) {
  test(lot + ': ' + pack.id + ' moves two effects on its hero, side illustration and three scenes in the six languages, and takes 75svh on a phone', { timeout: 300_000 }, async ({ app, browser, screen }) => {
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
      expect(config?.surfaces.map(surface => surface.name).sort(), path)
        .toEqual(['hero', 'plate', ...pack.scenes.flatMap(scene => ['scene-' + scene, 'scene-' + scene + '-expanded'])].sort());
      // On every painting, channel a is this pack's own layer and channel b its own accent.
      for (const surface of config!.surfaces) {
        for (const [scene, { layers }] of Object.entries(surface.scenes)) {
          expect(layers.map(layer => [layer.channel, mediaPathname(layer.src).replace(/-\d+-[0-9a-f]{12}\.\w+$/, '')]), `${path} ${surface.name} ${scene}`)
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
      await app.screenshot(shots + pack.id + '-' + lang + '-1920-scenes');
      // No pause control on any painting; reduced motion stops them all.
      expect(await browser.evaluate(() => document.querySelectorAll('.symbol-hero button, [data-living-surface] button, .atlas-scenes button, .slp-toggle').length)).toBe(0);
      await browser.emulateMedia({ reducedMotion: 'reduce' });
      await expectReducedSurfaces(browser);
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
      if (lang === 'fr') await app.screenshot(shots + pack.id + '-fr-390-hero');
    }
  });
}
