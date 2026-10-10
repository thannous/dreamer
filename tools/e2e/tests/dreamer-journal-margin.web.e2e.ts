// Historical UI assertions, run on the public TesterArmy web surface.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

test.use({ viewport: { width: 390, height: 867 }, timezoneId: 'Europe/Paris' });

async function startGuest(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openJournal(page: Page) {
  const back = page.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else await page.getByRole('tab', { name: 'Journal', exact: true }).click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
}

async function populatedJournal(page: Page) {
  // Select the canonical mock persona through the existing desktop QA entry.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startGuest(page);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.existing').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 867 });
  await openJournal(page);
}

async function findDream(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill(title);
  const card = page.getByTestId(/^dream\.item\.\d+$/).filter({ hasText: title, visible: true });
  await expect(card).toHaveCount(1);
  return card;
}

for (const theme of ['light', 'dark'] as const) {
  test(`journal keeps compact covers readable with a date margin in ${theme}`, async ({ page, context }, testInfo) => {
    await page.clock.setFixedTime(new Date(theme === 'light' ? '2026-10-03T12:00:00+02:00' : '2026-10-03T23:00:00+02:00'));
    // Optional private 9:16 artwork for local visual QA; CI uses the bright image
    // supplied by the offline-services fixture. No external image fetch occurs.
    if (process.env.E2E_JOURNAL_BRIGHT_IMAGE) {
      await context.route('https://picsum.photos/**', (route) => route.fulfill({ path: process.env.E2E_JOURNAL_BRIGHT_IMAGE! }));
    }
    await populatedJournal(page);
    const card = await findDream(page, 'The Infinite Library');
    const id = await card.getAttribute('data-testid');
    const margin = card.getByTestId(`journal.margin.${id}`);
    const cover = card.getByTestId(`journal.cover.${id}`);
    const text = card.getByTestId(`journal.text.${id}`);
    const metadata = card.getByTestId(`journal.metadata.${id}`);
    await expect(metadata).toContainText('Symbolic dream');
    await expect(metadata).toContainText('Mystical');
    await expect(card).toContainText('Analyzed');
    await expect(text).toContainText('I found myself in an enormous library');
    // React Native's layout event follows the phone/grid resize. Observe the
    // settled portrait frame rather than its initial width from the previous layout.
    await expect.poll(async () => {
      const bounds = (await cover.boundingBox())!;
      return Math.abs(bounds.height - Math.min(bounds.width * 16 / 9, 620));
    }).toBeLessThanOrEqual(1);
    const coverBounds = (await cover.boundingBox())!;
    const textBounds = (await text.boundingBox())!;
    const marginBounds = (await margin.boundingBox())!;
    expect(marginBounds.width).toBeGreaterThanOrEqual(88);
    expect(marginBounds.x + marginBounds.width).toBeLessThanOrEqual(coverBounds.x);
    expect(textBounds.y).toBeGreaterThanOrEqual(coverBounds.y);
    expect(textBounds.y + textBounds.height).toBeLessThanOrEqual(coverBounds.y + coverBounds.height);
    const backing = card.getByTestId(`journal.backing.${id}`);
    const backingBounds = (await backing.boundingBox())!;
    const lines = await backing.evaluate(node => Array.from(node.children).map(child => {
      const style = getComputedStyle(child);
      return Math.round(child.getBoundingClientRect().height / parseFloat(style.lineHeight));
    }));
    expect(lines[0]).toBeLessThanOrEqual(2);
    expect(lines[1]).toBeLessThanOrEqual(3);
    expect(lines.reduce((total, count) => total + count, 0)).toBeLessThanOrEqual(5);
    expect(backingBounds.y + backingBounds.height).toBeLessThanOrEqual(textBounds.y + textBounds.height);
    expect(await backing.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const badge = card.getByTestId(`journal.badge.${id}.0`);
    const badgeChildren = await badge.evaluate(node => Array.from(node.children).map(child => {
      const rect = child.getBoundingClientRect();
      return { x: rect.x, y: rect.y, height: rect.height };
    }));
    expect(badgeChildren).toHaveLength(2);
    expect(badgeChildren[0].x).toBeLessThan(badgeChildren[1].x);
    expect(Math.abs(badgeChildren[0].y + badgeChildren[0].height / 2
      - badgeChildren[1].y - badgeChildren[1].height / 2)).toBeLessThan(2);
    await cover.evaluate(async (node) => {
      await document.fonts.ready;
      await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => image.decode()));
      await new Promise(requestAnimationFrame);
      await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath(`${theme}-compact.png`) });
    // Browser-only 200% text stress check: this does not qualify native Dynamic Type.
    await backing.evaluate(node => {
      for (const child of Array.from(node.children)) {
        const style = getComputedStyle(child);
        const fontSize = parseFloat(style.fontSize) * 2;
        const lineHeight = parseFloat(style.lineHeight) * 2;
        (child as HTMLElement).style.setProperty('font-size', `${fontSize}px`, 'important');
        (child as HTMLElement).style.setProperty('line-height', `${lineHeight}px`, 'important');
      }
    });
    await expect.poll(async () => {
      const coverRect = (await cover.boundingBox())!;
      const textRect = (await text.boundingBox())!;
      return textRect.y + textRect.height <= coverRect.y + coverRect.height + 1;
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-browser-text-200.png`) });
    await card.click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText('Books were floating around me');
    await openJournal(page);

    const noImage = await findDream(page, 'Garden in the Clouds');
    const noImageId = await noImage.getAttribute('data-testid');
    await expect(noImage.getByTestId(`journal.cover.${noImageId}`)).toHaveCount(0);
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Lucid Dream');
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Recurring');
    await expect(noImage.getByTestId(`journal.metadata.${noImageId}`)).toContainText('Memory');
    await expect(noImage).toContainText('I was walking through a beautiful garden');
    await page.screenshot({ path: testInfo.outputPath(`${theme}-text-only.png`) });
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 1000 }, { width: 320, height: 640 }]) {
      await page.setViewportSize(viewport);
      // Rotation changes the number of columns and remounts the list. Observe
      // the resulting geometry rather than acting on the outgoing DOM node.
      await expect.poll(async () => noImage.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const columns = innerWidth >= 1440 ? 4 : innerWidth >= 768 ? 2 : 1;
        return node.isConnected && rect.width > 0 && rect.x >= 0
          && rect.right <= innerWidth && rect.width <= innerWidth / columns;
      }).catch(() => false)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${viewport.width}-text-only.png`) });
    }
  });
}

test('saved remembered dream keeps its indication and opens the full story', async ({ page }, testInfo) => {
  await startGuest(page);
  await openJournal(page);
  await page.getByTestId('btn.empty.startRememberedDream').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  const story = 'E2E remembered dream: the same blue door every night.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await openJournal(page);
  const card = page.getByTestId(/^dream\.item\.\d+$/).filter({ hasText: 'the same blue door', visible: true });
  await expect(card).toHaveCount(1);
  const id = await card.getAttribute('data-testid');
  await expect(card.getByTestId(`journal.metadata.${id}`)).toContainText('Memory');
  await page.screenshot({ path: testInfo.outputPath('saved-remembered.png') });
  await card.click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
});


test('failed thumbnail falls back to the full illustration', async ({ page, context }, testInfo) => {
  const failedThumbnails: string[] = [];
  await context.route('https://picsum.photos/seed/library-dream/400/300**', route => {
    failedThumbnails.push(route.request().url());
    return route.abort();
  });
  await populatedJournal(page);
  const card = await findDream(page, 'The Infinite Library');
  const id = await card.getAttribute('data-testid');
  const cover = card.getByTestId(`journal.cover.${id}`);
  await expect.poll(() => cover.locator('img').evaluateAll(images => images.some(image =>
    (image as HTMLImageElement).naturalWidth > 0 && (image as HTMLImageElement).src.includes('/800/600')
  ))).toBe(true);
  expect(failedThumbnails.length).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('thumbnail-full-fallback.png') });
});

test('failed illustration leaves a compact readable entry that still opens', async ({ page, context }, testInfo) => {
  await context.route('https://picsum.photos/seed/library-dream/**', route => route.abort());
  await populatedJournal(page);
  const card = await findDream(page, 'The Infinite Library');
  const id = await card.getAttribute('data-testid');
  await expect(card.getByTestId(`journal.cover.${id}`)).toHaveCount(0);
  await expect(card).toContainText('I found myself in an enormous library');
  expect((await card.boundingBox())!.height).toBeLessThan(260);
  await page.screenshot({ path: testInfo.outputPath('failed-illustration-text-fallback.png') });
  await card.click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('Books were floating around me');
});

test.describe('French quick filters', () => {
  test.use({ locale: 'fr-FR' });
  test('quick filters fit at393px and hint overflow while advanced filters remain reachable', async ({ page }, testInfo) => {
  await populatedJournal(page);
  for (const width of [393, 320]) {
    await page.setViewportSize({ width, height: 852 });
    const more = page.getByTestId('btn.filterMore');
    const scroll = page.getByTestId('journal-filter-scroll');
    const overflowHint = page.getByTestId('journal-filter-overflow');
    const filters = ['btn.filterAll', 'btn.filterFavorites', 'btn.filterToDeepen'];
    const bounds = await Promise.all(filters.map(id => page.getByTestId(id).boundingBox()));
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
      await scroll.evaluate(node => {
        for (const text of Array.from(node.querySelectorAll<HTMLElement>('[dir="auto"]'))) {
          if (!/SpaceGrotesk/.test(getComputedStyle(text).fontFamily)) continue;
          text.dataset.previousFontSize = text.style.fontSize;
          text.style.fontSize = `${parseFloat(getComputedStyle(text).fontSize) * 2}px`;
        }
      });
      await expect(overflowHint).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('filters-393-browser-text-200.png') });
      await scroll.evaluate(node => {
        for (const text of Array.from(node.querySelectorAll<HTMLElement>('[data-previous-font-size]'))) {
          text.style.fontSize = text.dataset.previousFontSize ?? '';
          delete text.dataset.previousFontSize;
        }
      });
    } else {
      await expect(overflowHint).toBeVisible();
      await expect(overflowHint).toHaveCSS('pointer-events', 'none');
    }
    await scroll.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    await expect(overflowHint).toHaveCount(0);
    await page.getByTestId('btn.filterToDeepen').click();
    await expect(page.getByRole('button', { name: /The Infinite Library,/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ocean of Stars,/ })).toHaveCount(0);
    await page.getByTestId('journal-filter-scroll').evaluate(node => { node.scrollLeft = 0; });
    await page.getByTestId('btn.filterAll').click();
    await more.click();
    await expect(page.getByTestId('modal.advancedFilters')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('modal.advancedFilters')).not.toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`filters-${width}.png`) });
  }
});

});
