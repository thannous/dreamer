import { expectInViewport, addCSS, answerSeal, createExactWebTest, expect, expectIllustrationOnPlate, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';

const test = createExactWebTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });

async function enter(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.profile').click();
  await screen.getByTestId('btn.mockProfile.plus').click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

// These journeys cover reachable controls and content; they do not qualify native
// screen-reader gestures or the motion quality of the seal on a physical device.
test('review: capture question keeps keyboard focus until a choice is made', async (ui) => {
  const { app, screen, browser } = ui;
  await enter(ui);
  const story = 'E2E keyboard traveler crosses a quiet bridge beneath the stars.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').click();
  const later = screen.getByTestId('btn.dreamCaptureSeal.readLater');
  await expect(later).toBeVisible();
  await expect.poll(() => browser.evaluate(() => document.activeElement?.getAttribute('role') ?? null)).toBe('heading');
  const visited = new Set<string>();
  for (let index = 0; index < 6; index++) {
    await browser.keyboard.press('Tab');
    const active = await browser.evaluate(() => document.activeElement?.getAttribute('data-testid')
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
  await app.screenshot('seal-choice-focus.png');
  await later.focus();
  await browser.keyboard.press('Enter');
  await expect(later).toHaveCount(0);
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(screen.getByTestId('btn.dream.primaryCta')).toBeEnabled();
});

test('review: keyboard page navigation reaches tonight and its write action on a short screen', async (ui) => {
  const { app, screen, browser } = ui;
  await enter(ui);
  const story = 'E2E tonight traveler watches a lantern float over the lake.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').click();
  await answerSeal(screen, 'later');
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await browser.setViewport({ width: 568, height: 320 });
  const next = screen.getByTestId('journal.page.next');
  await next.focus();
  await browser.keyboard.press('Enter');
  const write = screen.getByTestId('journal.tonight.write');
  await write.scrollIntoView();
  await expectInViewport(write, browser, 1);
  const reminder = screen.getByTestId('journal.tonight.remind');
  if (await reminder.count()) {
    await reminder.scrollIntoView();
    await expectInViewport(reminder, browser, 1);
  }
  await app.screenshot('tonight-short-screen.png');
  const previous = screen.getByTestId('journal.page.previous');
  await previous.focus();
  await browser.keyboard.press('Enter');
  await expect(screen.getByRole('button', { name: 'Write my dream', exact: true })).toHaveCount(0);
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await next.focus();
  await browser.keyboard.press('Enter');
  await write.click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
});

test('review: an illustrated long title remains fully inside a scrollable cover', async (ui) => {
  const { app, screen, browser } = ui;
  await enter(ui);
  await screen.getByTestId('input.dreamTranscript').fill('E2E illustrated traveler discovers a library inside a lighthouse.');
  await screen.getByTestId('btn.saveDream').click();
  await answerSeal(screen, 'now');
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await screen.getByTestId('btn.editDream').click();
  const title = 'A lantern illuminates the endless library beside the quiet ocean. '.repeat(6).trim();
  await screen.getByTestId('input.dreamTitle').fill(title);
  await screen.getByTestId('btn.saveDreamEdit').click();
  await screen.getByTestId('btn.journal.illustrate').click();
  await expect(screen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  await expectIllustrationOnPlate(screen);
  await browser.setViewport({ width: 320, height: 568 });
  await addCSS(browser, '[data-testid="component.metadataCard"] [role="heading"] { font-size: 42px !important; line-height: 54px !important; }');
  const heading = screen.getByRole('heading', { name: title, exact: true });
  const plate = screen.getByTestId('component.journal.illustration');
  await expect(heading).toHaveText(title);
  await expect.poll(async () => {
    const h = (await heading.boundingBox())!;
    const p = (await plate.boundingBox())!;
    return h.y >= p.y + 64 && h.y + h.height <= p.y + p.height + 1 && p.height > 568;
  }).toBe(true);
  await screen.getByTestId('component.transcriptCard').scrollIntoView();
  await expectInViewport(screen.getByTestId('component.transcriptCard'), browser);
  // The page stays clean: no bar over it; its turns sit at its foot, after its last action.
  const next = screen.getByTestId('journal.page.next');
  await next.scrollIntoView();
  await expect(next).toBeVisible();
  const deleteBox = (await screen.getByTestId('btn.dream.delete').boundingBox())!;
  expect((await next.boundingBox())!.y).toBeGreaterThan(deleteBox.y);
  await app.screenshot('long-cover-title.png');
});
