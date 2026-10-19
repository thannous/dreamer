import type { Page } from 'playwright/test';
import { answerSeal, createParityTest, expect, expectIllustrationOnPlate, withDialog } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });

async function enter(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

// These journeys cover reachable controls and content; they do not qualify native
// screen-reader gestures or the motion quality of the seal on a physical device.
test('review: capture question keeps keyboard focus until a choice is made', async ({ page }, info) => {
  await enter(page);
  const story = 'E2E keyboard traveler crosses a quiet bridge beneath the stars.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
  await expect(later).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('heading');
  const visited = new Set<string>();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid')
      ?? document.activeElement?.getAttribute('role') ?? 'outside');
    // Since #439 the capture modal also offers "See my dream" from the moment the save is
    // durable: a choice too (it keeps any answer already given), so focus may rest on it.
    expect(['heading', 'btn.dreamCaptureSeal.readNow', 'btn.dreamCaptureSeal.readLater',
      'btn.dreamCaptureSeal.openDream']).toContain(active);
    visited.add(active);
  }
  expect(visited.has('btn.dreamCaptureSeal.readNow')).toBe(true);
  expect(visited.has('btn.dreamCaptureSeal.readLater')).toBe(true);
  expect(visited.has('btn.dreamCaptureSeal.openDream')).toBe(true);
  await page.screenshot({ path: info.outputPath('seal-choice-focus.png') });
  await later.focus();
  await page.keyboard.press('Enter');
  await expect(later).toHaveCount(0);
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByTestId('btn.dream.primaryCta')).toBeEnabled();
});

test('review: keyboard page navigation reaches tonight and its write action on a short screen', async ({ page }, info) => {
  await enter(page);
  const story = 'E2E tonight traveler watches a lantern float over the lake.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await answerSeal(page, 'later');
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.setViewportSize({ width: 568, height: 320 });
  const next = page.getByTestId('journal.page.next');
  await next.focus();
  await page.keyboard.press('Enter');
  const write = page.getByTestId('journal.tonight.write');
  await write.scrollIntoViewIfNeeded();
  await expect(write).toBeInViewport({ ratio: 1 });
  const reminder = page.getByTestId('journal.tonight.remind');
  if (await reminder.count()) {
    await reminder.scrollIntoViewIfNeeded();
    await expect(reminder).toBeInViewport({ ratio: 1 });
  }
  await page.screenshot({ path: info.outputPath('tonight-short-screen.png') });
  const previous = page.getByTestId('journal.page.previous');
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Write my dream', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await next.focus();
  await page.keyboard.press('Enter');
  await write.click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
});

test('review: an illustrated long title remains fully inside a scrollable cover', async ({ page }, info) => {
  await enter(page);
  await page.getByTestId('input.dreamTranscript').fill('E2E illustrated traveler discovers a library inside a lighthouse.');
  await page.getByTestId('btn.saveDream').click();
  await answerSeal(page, 'now');
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await page.getByTestId('btn.editDream').click();
  const title = 'A lantern illuminates the endless library beside the quiet ocean. '.repeat(6).trim();
  await page.getByTestId('input.dreamTitle').fill(title);
  await page.getByTestId('btn.saveDreamEdit').click();
  await page.getByTestId('btn.journal.illustrate').click();
  await expect(page.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  await expectIllustrationOnPlate(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: '[data-testid="component.metadataCard"] [role="heading"] { font-size: 42px !important; line-height: 54px !important; }' });
  const heading = page.getByRole('heading', { name: title, exact: true });
  const plate = page.getByTestId('component.journal.illustration');
  await expect(heading).toHaveText(title);
  await expect.poll(async () => {
    const h = (await heading.boundingBox())!;
    const p = (await plate.boundingBox())!;
    return h.y >= p.y + 64 && h.y + h.height <= p.y + p.height + 1 && p.height > 568;
  }).toBe(true);
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('component.transcriptCard')).toBeInViewport();
  // The page stays clean: no bar over it; its turns sit at its foot, after its last action.
  const next = page.getByTestId('journal.page.next');
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeVisible();
  const deleteBox = (await page.getByTestId('btn.dream.delete').boundingBox())!;
  expect((await next.boundingBox())!.y).toBeGreaterThan(deleteBox.y);
  await page.screenshot({ path: info.outputPath('long-cover-title.png') });
});
