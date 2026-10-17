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


// Real image decoding and physical display dimensions catch placeholders, missing
// uploads and enlargement that a generated-HTML string check cannot observe.
test('the 40 new symbol illustrations load without enlargement on wide screens', { timeout: 180_000 }, async ({ app, browser, screen }) => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/dream-symbols.json', import.meta.url), 'utf8')) as {
    symbols: Array<{ id: string; fr: { slug: string; name: string } }>;
  };
  const ids = ["sex","cheating","kissing","attack","killing","fighting","eating","kidnapping","moving-house","war","vomiting","nails","tsunami","flowers","tiger","deer","pig","monkey","lizard","bat","toilet","church","beach","castle","swimming-pool","alien","celebrity","boss","crush","witch","clown","gun","knife","wallet","doll","gold","coffin","stars","sky","god"];
  await browser.setViewport({ width: 3840, height: 2160 });
  for (const id of ids) {
    const symbol = catalog.symbols.find(item => item.id === id)!;
    await app.open('/fr/symboles/' + symbol.fr.slug + '.html');
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    const image = await browser.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>('.symbol-hero img')!;
      await img.decode();
      const box = img.getBoundingClientRect();
      return { src: img.currentSrc, width: box.width, height: box.height,
        dpr: window.devicePixelRatio, naturalWidth: img.naturalWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(image.src).toMatch(new RegExp('/' + id + '-v1-[0-9]+w\\.(?:webp|avif)$'));
    expect(image.naturalWidth).toBeGreaterThan(0);
    const pixels = Number(image.src.match(/-([0-9]+)w\.(?:webp|avif)$/)![1]);
    expect(image.width * image.dpr).toBeLessThanOrEqual(pixels + 1);
    expect(image.height * image.dpr).toBeLessThanOrEqual(pixels * 9 / 16 + 1);
    expect(image.width / image.height).toBeCloseTo(16 / 9, 2);
    expect(image.overflow).toBe(false);
    if (['sex', 'tiger', 'god'].includes(id)) await app.screenshot('symbol-' + id + '-wide');
  }
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/fr/symboles/tigre.html');
  await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const mobile = await browser.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>('.symbol-hero img')!;
    await img.decode();
    const box = img.getBoundingClientRect();
    return { width: box.width, height: box.height, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(mobile.width).toBeLessThanOrEqual(390);
  expect(mobile.width / mobile.height).toBeCloseTo(16 / 9, 2);
  expect(mobile.overflow).toBe(false);
  await app.screenshot('symbol-tiger-mobile');
});
