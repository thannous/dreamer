import type { Page } from 'playwright/test';
import { test, expect } from './fixtures';

test.use({ viewport: { width: 390, height: 867 }, timezoneId: 'Europe/Paris' });

async function startGuest(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
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
  await page.getByTestId('btn.recording.home').click();
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
  test(`journal keeps portrait text readable and metadata in the margin in ${theme}`, async ({ page, context }, testInfo) => {
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
    await expect(margin).toContainText('Symbolic Dream');
    await expect(margin).toContainText('Mystical');
    await expect(margin).toContainText('Analyzed');
    await expect(text).toContainText('I found myself in an enormous library');
    const coverBounds = (await cover.boundingBox())!;
    const textBounds = (await text.boundingBox())!;
    const marginBounds = (await margin.boundingBox())!;
    expect(coverBounds.height / coverBounds.width).toBeCloseTo(16 / 9, 1);
    expect(marginBounds.x + marginBounds.width).toBeLessThanOrEqual(coverBounds.x);
    expect(textBounds.y).toBeGreaterThanOrEqual(coverBounds.y);
    expect(textBounds.y + textBounds.height).toBeLessThan(coverBounds.y + coverBounds.height);
    await cover.evaluate(async (node) => {
      await document.fonts.ready;
      await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => image.decode()));
      await new Promise(requestAnimationFrame);
      await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath(`${theme}-portrait.png`) });
    await card.click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText('Books were floating around me');
    await openJournal(page);

    const noImage = await findDream(page, 'Garden in the Clouds');
    const noImageId = await noImage.getAttribute('data-testid');
    await expect(noImage.getByTestId(`journal.cover.${noImageId}`)).toHaveCount(0);
    await expect(noImage.getByTestId(`journal.margin.${noImageId}`)).toContainText('Lucid Dream');
    await expect(noImage.getByTestId(`journal.margin.${noImageId}`)).toContainText('Recurring');
    await expect(noImage.getByTestId(`journal.margin.${noImageId}`)).toContainText('Memory');
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
  const margin = card.getByTestId(`journal.margin.${id}`);
  await expect(margin).toContainText('Memory');
  await page.screenshot({ path: testInfo.outputPath('saved-remembered.png') });
  await card.click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
});
