import { readDOM, byId, expectCSS, expectInViewport, setTestDate, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import { test as webTest } from '@e2e-dev/web';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ viewport: { width: 390, height: 867 } });


async function startGuest(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function openJournal(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  const back = uiScreen.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else await uiScreen.getByRole('tab', { name: 'Journal', exact: true }).click();
  await expect(uiScreen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

async function populatedJournal(ui: ExactWebUI) {
  const { screen: uiScreen, browser } = ui;
  // Select the canonical mock persona through the existing desktop QA entry.
  await browser.setViewport({ width: 1440, height: 1000 });
  await startGuest(ui);
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.all').click();
  await uiScreen.getByTestId('settings-account-open-signin').click();
  await uiScreen.getByTestId('btn.mockProfile.existing').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await browser.setViewport({ width: 390, height: 867 });
  // The desktop-to-phone resize can still be closing the drawer over the cards.
  // Observe its nonzero profile row: the scroll container itself can have no
  // intersection while its closing content still covers the cards.
  await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
  await openJournal(ui);
  // A closed drawer cannot widen the document or return over the journal.
  await expect.poll(() => browser.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function findDream(ui: ExactWebUI, title: string) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByRole('textbox', { name: 'Search dreams…' }).fill(title);
  // The entry is already listed before the search applies, and the web list then mounts
  // its rows again: wait for the search's single result rather than the earlier row.
  await expect(uiScreen.getByTestId(/^dream\.item\.\d+$/, { visible: true })).toHaveCount(1);
  const card = uiScreen.getByTestId(/^dream\.item\.\d+$/, { visible: true }).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  return card;
}

for (const theme of ['light', 'dark'] as const) {
  test(`journal shows each painting whole with its dream on a veil in ${theme}`, async (ui) => {
 const { app, screen: uiScreen, browser } = ui;
    await setTestDate(browser, theme === 'light' ? '2026-10-03T12:00:00+02:00' : '2026-10-03T23:00:00+02:00');
    // Optional private 9:16 artwork for local visual QA; CI uses the bright image
    // supplied by the offline-services fixture. No external image fetch occurs.
    if (process.env.E2E_JOURNAL_BRIGHT_IMAGE) {
      await browser.route('https://picsum.photos/**', (route) => route.fulfill({ path: process.env.E2E_JOURNAL_BRIGHT_IMAGE! }));
    }
    await populatedJournal(ui);
    const card = await findDream(ui, 'The Infinite Library');
    const id = await card.getAttribute('data-testid');
    const cover = card.getByTestId(`journal.cover.${id}`);
    const text = card.getByTestId(`journal.text.${id}`);
    const metadata = card.getByTestId(`journal.metadata.${id}`);
    await expect(metadata).toContainText('Symbolic dream');
    await expect(metadata).toContainText('Mystical');
    // Revised 2026-10-20 (was 'Analyzed'): the owner removed that label from the cards; an
    // analysed dream is the usual case and names no state.
    await expect(metadata).not.toContainText('Analyzed');
    await expect(text).toContainText('I found myself in an enormous library');
    // React Native's layout event follows the phone/grid resize. Observe the
    // settled portrait frame rather than its initial width from the previous layout.
    const screenHeight = await browser.evaluate(() => screen.height);
    await expect.poll(async () => {
      const bounds = await cover.boundingBox();
      // A responsive list remount can briefly remove the cover between reads.
      // Keep polling the same geometry contract instead of throwing on null.
      return bounds ? Math.abs(bounds.height - Math.min(bounds.width * 16 / 9, Math.round(screenHeight * 0.8))) : Infinity;
    }).toBeLessThanOrEqual(1);
    // One snapshot of the card, relative to its painting: the list can still shift it
    // on the page while the search settles.
    const layout = await readDOM(browser, byId(id!), (node, cardId) => {
      const rect = (testId: string) => node.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect();
      const coverRect = rect(`journal.cover.${cardId}`);
      const relative = (testId: string) => {
        const box = rect(testId);
        return { top: box.top - coverRect.top, bottom: box.bottom - coverRect.top, left: box.left - coverRect.left, width: box.width };
      };
      return { width: coverRect.width, height: coverRect.height, text: relative(`journal.text.${cardId}`),
        date: relative(`journal.date.${cardId}`),
        actions: [relative(`journal.favorite.${cardId}`), relative(`journal.share.${cardId}`)] };
    }, id);
    // The painting spans the list, and the dream's text sits at its foot, inside it.
    expect(layout.width).toBeGreaterThanOrEqual(390 - 32 - 1);
    expect(layout.text.top).toBeGreaterThanOrEqual(layout.height / 2);
    expect(Math.abs(layout.text.bottom - layout.height)).toBeLessThanOrEqual(1);
    expect(await readDOM(browser, byId(`journal.text.${id}`), node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const lines = await readDOM(browser, byId(`journal.text.${id}`), node => [node.children[0],
      node.querySelector('[data-testid^="journal.preview."]')!].map(child => {
      return Math.round(child.getBoundingClientRect().height / parseFloat(getComputedStyle(child).lineHeight));
    }));
    // Revised 2026-10-20 (was the date's line above the title): the owner moved the date to the
    // icons' line, so the veil holds at most two lines of title and three of the dream.
    expect(lines[0]).toBeLessThanOrEqual(2);
    expect(lines[1]).toBeLessThanOrEqual(3);
    // The heart and share icons sit over the painting's top right.
    for (const action of layout.actions) {
      expect(action.width).toBeGreaterThanOrEqual(44);
      expect(action.top).toBeLessThan(60);
      expect(action.left).toBeGreaterThan(layout.width / 2);
    }
    // The date leads that line, as tall as the icons and clear of the heart.
    expect(Math.abs(layout.date.top - layout.actions[0].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.date.bottom - layout.actions[0].bottom)).toBeLessThanOrEqual(1);
    expect(layout.date.left).toBeLessThan(layout.width / 2);
    expect(layout.date.left + layout.date.width).toBeLessThanOrEqual(layout.actions[0].left);
    await expect(card.getByTestId(`journal.date.${id}`)).toHaveText(/^\d{1,2}\D/);
    // The arrow follows the dream's last line, at the foot of the painting, folded or not.
    const expand = card.getByTestId(`journal.expand.${id}`);
    const preview = card.getByTestId(`journal.preview.${id}`);
    const arrowGap = async () => {
      const [arrow, last] = [await expand.boundingBox(), await preview.boundingBox()];
      return arrow && last ? Math.abs(arrow.y + arrow.height - last.y - last.height) : Infinity;
    };
    await expect.poll(arrowGap).toBeLessThanOrEqual(2);
    await expand.click();
    await expect(expand).toHaveAccessibleName('Show less');
    await expect.poll(async () => (await preview.boundingBox())!.height).toBeGreaterThan(3 * 22 + 1);
    await expect.poll(arrowGap).toBeLessThanOrEqual(2);
    await expand.click();
    await expect(expand).toHaveAccessibleName('Read the whole dream');
    await readDOM(browser, byId(`journal.cover.${id}`), async (node) => {
      await document.fonts.ready;
      await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => image.decode()));
      await new Promise(requestAnimationFrame);
      await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
    await app.screenshot(`${theme}-compact.png`);
    // Browser-only 200% text stress check: this does not qualify native Dynamic Type.
    await readDOM(browser, byId(`journal.text.${id}`), node => {
      for (const child of Array.from(node.querySelectorAll<HTMLElement>('[dir="auto"]'))) {
        const style = getComputedStyle(child);
        const fontSize = parseFloat(style.fontSize) * 2;
        const lineHeight = parseFloat(style.lineHeight) * 2;
        (child as HTMLElement).style.setProperty('font-size', `${fontSize}px`, 'important');
        (child as HTMLElement).style.setProperty('line-height', `${lineHeight}px`, 'important');
      }
    });
    // The card grows with its text, and the arrow follows the last line to its new place.
    await expect.poll(arrowGap).toBeLessThanOrEqual(2);
    await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
    await app.screenshot(`${theme}-browser-text-200.png`);
    await card.click();
    await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('Books were floating around me');
    await openJournal(ui);

    // Revised 2026-10-20 (was the 'Deepened' label): the owner removed it from the cards too.
    const explored = await findDream(ui, 'Ocean of Stars');
    const exploredId = await explored.getAttribute('data-testid');
    await expect(explored.getByTestId(`journal.metadata.${exploredId}`)).toContainText('Symbolic dream');
    await expect(explored.getByTestId(`journal.metadata.${exploredId}`)).not.toContainText('Deepened');
    // A state label keeps its icon on its own line, here a dream still being analysed.
    const pending = await findDream(ui, 'The Forgotten Classroom');
    const pendingId = await pending.getAttribute('data-testid');
    await expect(pending.getByTestId(`journal.metadata.${pendingId}`)).toContainText('Analyzing');
    const badgeChildren = await readDOM(browser, byId(`journal.badge.${pendingId}.0`), node => Array.from(node.children).map(child => {
      const rect = child.getBoundingClientRect();
      return { x: rect.x, y: rect.y, height: rect.height };
    }));
    expect(badgeChildren).toHaveLength(2);
    expect(badgeChildren[0].x).toBeLessThan(badgeChildren[1].x);
    expect(Math.abs(badgeChildren[0].y + badgeChildren[0].height / 2
      - badgeChildren[1].y - badgeChildren[1].height / 2)).toBeLessThan(2);

    const noImage = await findDream(ui, 'Garden in the Clouds');
    const noImageId = await noImage.getAttribute('data-testid');
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Lucid Dream');
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Recurring');
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Memory');
    await expect(noImage).toContainText('I was walking through a beautiful garden');
    // Revised 2026-10-20 (was a compact card with a 60 pt seal at its top left): the owner asked
    // for one card size, so a dream without a painting keeps the painting's frame and its seal
    // stands in it, centred between the icons and the dream's text.
    const noImageCover = noImage.getByTestId(`journal.cover.${noImageId}`);
    await expect(noImage.getByTestId(`journal.seal.${noImageId}`)).toBeVisible();
    await expect.poll(async () => {
      const bounds = await noImageCover.boundingBox();
      return bounds ? Math.abs(bounds.height - Math.min(bounds.width * 16 / 9, Math.round(screenHeight * 0.8))) : Infinity;
    }).toBeLessThanOrEqual(1);
    const sealPlace = await readDOM(browser, byId(noImageId!), (node, cardId) => {
      const box = (testId: string) => node.querySelector(`[data-testid="${testId}.${cardId}"]`)!.getBoundingClientRect();
      const [cover, seal, share, text] = [box('journal.cover'), box('journal.seal'), box('journal.share'), box('journal.text')];
      return {
        centred: Math.abs(seal.left + seal.width / 2 - cover.left - cover.width / 2) <= 1,
        clearOfIcons: seal.top > share.bottom, aboveText: seal.bottom < text.top,
        textAtFoot: Math.abs(text.bottom - cover.bottom) <= 1,
      };
    }, noImageId);
    expect(sealPlace).toEqual({ centred: true, clearOfIcons: true, aboveText: true, textAtFoot: true });
    await app.screenshot(`${theme}-text-only.png`);
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 1000 }, { width: 320, height: 640 }]) {
      await browser.setViewport(viewport);
      // Rotation changes the number of columns and remounts the list. Observe
      // the resulting geometry rather than acting on the outgoing DOM node.
      await expect.poll(async () => readDOM(browser, byId(noImageId!), (node) => {
        const rect = node.getBoundingClientRect();
        const columns = innerWidth >= 1440 ? 4 : innerWidth >= 768 ? 2 : 1;
        return node.isConnected && rect.width > 0 && rect.x >= 0
          && rect.right <= innerWidth && rect.width <= innerWidth / columns;
      }).catch(() => false)).toBe(true);
      // However narrow the card, its seal stays below the icons and above the dream's text, and
      // its date stays clear of the heart.
      await expect.poll(async () => readDOM(browser, byId(noImageId!), (node) => {
        const box = (prefix: string) => node.querySelector(`[data-testid^="${prefix}"]`)!.getBoundingClientRect();
        const [seal, share, text, date, favorite] = [box('journal.seal.'), box('journal.share.'), box('journal.text.'),
          box('journal.date.'), box('journal.favorite.')];
        return seal.top >= share.bottom && seal.bottom <= text.top && date.right <= favorite.left && date.bottom <= seal.top;
      }).catch(() => false)).toBe(true);
      await app.screenshot(`${theme}-${viewport.width}-text-only.png`);
    }
    // The tablet and desktop grids narrow the painted card after its first frame:
    // the arrow still sits beside the dream's last line.
    const painted = await findDream(ui, 'The Infinite Library');
    const paintedId = await painted.getAttribute('data-testid');
    const paintedArrowGap = async () => {
      const [arrow, last] = [await painted.getByTestId(`journal.expand.${paintedId}`).boundingBox().catch(() => null),
        await painted.getByTestId(`journal.preview.${paintedId}`).boundingBox().catch(() => null)];
      return arrow && last ? Math.abs(arrow.y + arrow.height - last.y - last.height) : Infinity;
    };
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }]) {
      await browser.setViewport(viewport);
      await expect.poll(paintedArrowGap).toBeLessThanOrEqual(2);
      await app.screenshot(`${theme}-${viewport.width}-painted.png`);
    }
  });
}

test('saved remembered dream keeps its indication and opens the full story', async (ui) => {
  const { app, screen: uiScreen } = ui;
  await startGuest(ui);
  await openJournal(ui);
  await uiScreen.getByTestId('btn.empty.startRememberedDream').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  const story = 'E2E remembered dream: the same blue door every night.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await openJournal(ui);
  const card = uiScreen.getByTestId(/^dream\.item\.\d+$/, { visible: true }).filter({ hasText: 'the same blue door' });
  await expect(card).toHaveCount(1);
  const id = await card.getAttribute('data-testid');
  await expect(card.getByTestId(`journal.metadata.${id}`)).toContainText('Memory');
  await app.screenshot('saved-remembered.png');
  await card.click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
});

test('failed thumbnail falls back to the full illustration', async (ui) => {
 const { app, browser } = ui;
  // The Infinite Library is painted with the bundled cat art; its thumbnail has its own address.
  const failedThumbnails: string[] = [];
  await browser.route(/cat\.[^/]*\.webp\?.*variant=thumbnail|cat\.webp.*variant=thumbnail/, route => {
    failedThumbnails.push(route.request.url);
    return route.abort();
  });
  await populatedJournal(ui);
  const card = await findDream(ui, 'The Infinite Library');
  const id = await card.getAttribute('data-testid');
  await expect.poll(() => readDOM(browser, byId(`journal.cover.${id}`), node => Array.from(node.querySelectorAll('img')).some(image =>
    (image as HTMLImageElement).naturalWidth > 0 && /cat/.test((image as HTMLImageElement).src)
      && !(image as HTMLImageElement).src.includes('variant=thumbnail')
  ))).toBe(true);
  expect(failedThumbnails.length).toBeGreaterThan(0);
  await app.screenshot('thumbnail-full-fallback.png');
});

test('failed illustration leaves the seal in the painting frame and still opens', async (ui) => {
 const { app, screen: uiScreen, browser } = ui;
  // Both the thumbnail and the full illustration of the bundled cat art fail.
  await browser.route(/cat(\.[^/]*)?\.webp/, route => route.abort());
  await populatedJournal(ui);
  const card = await findDream(ui, 'The Infinite Library');
  const id = await card.getAttribute('data-testid');
  await expect(card).toContainText('I found myself in an enormous library');
  // Revised 2026-10-20 (was a compact entry under 300 px with no frame): the owner asked for one
  // card size, so once every source has failed the dream's seal takes the painting's place and
  // the card keeps the painting's frame.
  await expect(card.getByTestId(`journal.seal.${id}`)).toBeVisible();
  const cover = card.getByTestId(`journal.cover.${id}`);
  const screenHeight = await browser.evaluate(() => screen.height);
  await expect.poll(async () => {
    const bounds = await cover.boundingBox();
    return bounds ? Math.abs(bounds.height - Math.min(bounds.width * 16 / 9, Math.round(screenHeight * 0.8))) : Infinity;
  }).toBeLessThanOrEqual(1);
  await app.screenshot('failed-illustration-text-fallback.png');
  await card.click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('Books were floating around me');
});

webTest.describe('French quick filters', () => {
  const frenchTest = createExactWebTest({ viewport: { width: 390, height: 867 }, locale: 'fr-FR' });
  frenchTest('quick filters fit at393px and hint overflow while advanced filters remain reachable', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await populatedJournal(ui);
  for (const width of [393, 320]) {
    await browser.setViewport({ width, height: 852 });
    const more = uiScreen.getByTestId('btn.filterMore');
    const scroll = uiScreen.getByTestId('journal-filter-scroll');
    const overflowHint = uiScreen.getByTestId('journal-filter-overflow');
    const filters = ['btn.filterAll', 'btn.filterFavorites', 'btn.filterToDeepen'];
    const chipBounds = () => Promise.all(filters.map(id => uiScreen.getByTestId(id).boundingBox()));
    // The journal lays out again after a resize. Wait for the row to rest in one line below
    // the floating header: taps still reach chips the header covers, so clicks prove nothing.
    const header = uiScreen.getByTestId('journal-search-chrome', { visible: true });
    const rowPlacement = async () => {
      const [row, chrome] = await Promise.all([chipBounds(), header.boundingBox()]);
      if (!chrome || row.some(bound => !bound)) return 'measuring';
      const rowCenters = row.map(bound => bound!.y + bound!.height / 2);
      if (Math.max(...rowCenters) - Math.min(...rowCenters) > 2) return 'row moving';
      return Math.min(...row.map(bound => bound!.y)) >= chrome.y + chrome.height ? 'below header' : 'under header';
    };
    await expect.poll(rowPlacement).toBe('below header');
    const bounds = await chipBounds();
    expect(bounds.every(bound => bound && bound.height >= 44)).toBe(true);
    const centers = bounds.map(bound => bound!.y + bound!.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
    const moreBounds = (await more.boundingBox())!;
    expect(moreBounds.width).toBeGreaterThanOrEqual(44);
    expect(moreBounds.x + moreBounds.width).toBeLessThanOrEqual(width);
    const scrollBounds = (await scroll.boundingBox())!;
    if (width === 393) {
      expect(bounds.every(bound => bound!.x >= scrollBounds.x
        && bound!.x + bound!.width <= scrollBounds.x + scrollBounds.width + 1)).toBe(true);
      await expect(overflowHint).toHaveCount(0);
      // Browser-only enlargement; native Dynamic Type remains independently qualified.
      await readDOM(browser, byId('journal-filter-scroll'), node => {
        for (const text of Array.from(node.querySelectorAll<HTMLElement>('[dir="auto"]'))) {
          if (!/Outfit/.test(getComputedStyle(text).fontFamily)) continue;
          text.dataset.previousFontSize = text.style.fontSize;
          text.style.fontSize = `${parseFloat(getComputedStyle(text).fontSize) * 2}px`;
        }
      });
      await expect(overflowHint).toBeVisible();
      await app.screenshot('filters-393-browser-text-200.png');
      await readDOM(browser, byId('journal-filter-scroll'), node => {
        for (const text of Array.from(node.querySelectorAll<HTMLElement>('[data-previous-font-size]'))) {
          text.style.fontSize = text.dataset.previousFontSize ?? '';
          delete text.dataset.previousFontSize;
        }
      });
    } else {
      await expect(overflowHint).toBeVisible();
      await expectCSS(browser, byId('journal-filter-overflow'), 'pointer-events', 'none');
    }
    await readDOM(browser, byId('journal-filter-scroll'), node => { node.scrollLeft = node.scrollWidth; });
    await expect(overflowHint).toHaveCount(0);
    await uiScreen.getByTestId('btn.filterToDeepen').click();
    await expect(uiScreen.getByRole('button', { name: /The Infinite Library,/ })).toBeVisible();
    await expect(uiScreen.getByRole('button', { name: /Ocean of Stars,/ })).toHaveCount(0);
    await readDOM(browser, byId('journal-filter-scroll'), node => { node.scrollLeft = 0; });
    await uiScreen.getByTestId('btn.filterAll').click();
    await more.click();
    await expect(uiScreen.getByTestId('modal.advancedFilters')).toBeVisible();
    await browser.keyboard.press('Escape');
    await expect(uiScreen.getByTestId('modal.advancedFilters')).not.toBeVisible();
    // The first read can come before the screen renders at the new width; after these
    // taps it has, so the row must still rest below the header.
    expect(await rowPlacement()).toBe('below header');
    await app.screenshot(`filters-${width}.png`);
  }
});

});
