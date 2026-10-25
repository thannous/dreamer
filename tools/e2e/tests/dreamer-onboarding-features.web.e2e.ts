// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
import type { Locator, Page } from 'playwright/test';
const test = createParityTest();
const defaultFeatureTest = createParityTest();

test.use({ timezoneId: 'Europe/Paris' });
defaultFeatureTest.use({ timezoneId: 'Europe/Paris' });

// Each page's button arrives once its scene has played; click() waits until it is enabled.
async function readToExample(page: Page, feature: string) {
  for (const step of [1, 2, 3]) {
    await page.getByTestId('btn.onboarding.story.next').click();
    await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
  }
}

async function openDemo(page: Page, feature: string) {
  await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
  await readToExample(page, feature);
}

// Noctalia's reply arrives word by word, spaced by a gap rather than space characters, so
// the DOM text runs the words together; the whole sentence is the reveal's accessible label.
const reply = (followup: Locator, text: string) => followup.getByLabel(text, { exact: true });

// The Explorer example waits for the reader's answer: Noctalia replies, then the button arrives.
async function answerExample(page: Page) {
  await page.getByTestId('btn.onboarding.dialogue.home').click();
  await expect(reply(page.getByTestId('component.onboarding.dialogue.followup'), 'What do you miss about that house?')).toBeVisible();
  await expect(page.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
}

// The cross means "I want out": it asks before leaving the introduction for the path.
async function leaveStories(page: Page) {
  let question = '';
  await withDialog(page, async (dialog) => { question = dialog.message; await dialog.accept(); },
    () => page.getByTestId('btn.onboarding.feature.close').click());
  expect(question).toContain('Leave the introduction?');
  await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
}

// Declining the question keeps the reader in the story.
async function keepReading(page: Page) {
  await withDialog(page, 'dismiss', () => page.getByTestId('btn.onboarding.feature.close').click());
  await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
}

async function backToIntroduction(page: Page) {
  await page.getByTestId('btn.onboarding.back').click();
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
}

async function expectCloseButton(page: Page) {
  const close = page.getByTestId('btn.onboarding.feature.close');
  await expect(close).toHaveRole('button');
  await expect(close).toHaveAccessibleName('Close');
  // Capture the settled sheet, including its body, rather than a frame mid-open.
  await close.evaluate(async (node) => {
    const drawer = node.closest('[role="dialog"]');
    if (drawer) await Promise.all(drawer.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  await expect(close).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
  // Read both rectangles in one frame while the existing drawer animation runs.
  const bounds = await close.evaluate((node) => {
    const button = node.getBoundingClientRect();
    const sheet = document.querySelector('[data-testid="sheet.onboarding.feature"]')!.getBoundingClientRect();
    return { width: button.width, height: button.height, rightInset: sheet.right - button.right, topInset: button.top - sheet.top };
  });
  expect(Math.round(bounds.width)).toBeGreaterThanOrEqual(48);
  expect(Math.round(bounds.height)).toBeGreaterThanOrEqual(48);
  expect(bounds.rightInset).toBeLessThanOrEqual(26);
  expect(bounds.topInset).toBeGreaterThanOrEqual(0);
  expect(bounds.topInset).toBeLessThan(64);
}

async function openOnboarding({ page }: { page: Page }) {
  // The default dynamic theme follows local time; fix it for repeatable captures.
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+02:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  // The startup overlay ignores pointer events; wait until it leaves before captures or taps.
  await expect(page.getByText('NOCTALIA', { exact: true })).toHaveCount(0);
}

test.beforeEach(openOnboarding);
defaultFeatureTest.beforeEach(openOnboarding);
// This OFF-only case is excluded during collection before an ON bundle opens.
defaultFeatureTest.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true', 'The feature flag is enabled for this bundle.');
defaultFeatureTest('feature sheets stay disabled when switched off while onboarding and privacy remain usable', async ({ page }, testInfo) => {
  for (const feature of ['capture', 'connect', 'explore']) {
    const signal = page.getByTestId(`btn.onboarding.feature.${feature}`);
    await expect(signal).toBeVisible();
    await expect(signal).not.toHaveRole('button');
    await signal.click();
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath('feature-sheets-disabled.png') });
  await page.getByTestId('btn.onboarding.privacy').click();
  await expect(page.getByTestId('sheet.onboarding.privacy')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('sheet.onboarding.privacy')).toHaveCount(0);
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(page);
  await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
});

test('the chosen path is announced as selected and survives a return to the introduction', async ({ page }) => {
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(page);
  const memory = page.getByTestId('btn.onboarding.path.memory');
  await memory.click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('btn.onboarding.path.analyze')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('btn.onboarding.back').click();
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  // The stories are told once: returning to the introduction goes straight back to the path.
  await page.getByTestId('btn.onboarding.intro.next').click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
});

test('the welcome and path remain inside the viewport without off-canvas horizontal overflow', async ({ page }, testInfo) => {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(page);
  await page.getByTestId('btn.onboarding.path.memory').click();
  await expect(page.getByTestId('btn.onboarding.path.memory')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  const position = await page.getByTestId('screen.onboarding').boundingBox();
  expect(position!.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('path-within-viewport.png') });
});

test.describe('feature sheet previews', () => {
  test.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true', 'Feature sheets are switched off for this bundle.');

  for (const theme of ['light', 'dark'] as const) {
    // Product change (owner, 2026-10-10): the cross means leaving the introduction. It asks
    // first, and leaving goes on to the path instead of back to the introduction.
    test(`each story's top-right cross asks before leaving the introduction in ${theme} theme`, async ({ page }, testInfo) => {
      if (theme === 'dark') {
        await page.clock.setFixedTime(new Date('2026-10-02T23:00:00+02:00'));
        await page.reload();
      }
      for (const feature of ['capture', 'connect', 'explore']) {
        await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
        await expect(page.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
        await expectCloseButton(page);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${feature}.png`) });
        await keepReading(page);
        await expect(page.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
        await leaveStories(page);
        await backToIntroduction(page);
      }
      // Once left, the stories are not told again: Commencer goes straight to the path.
      await page.getByTestId('btn.onboarding.intro.next').click();
      await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
    });
  }

  // Product change (owner, 2026-10-10): only the cross ends a story, so no stray key or
  // swipe can close it by accident.
  test('Escape keeps a story open; only the cross leaves it', async ({ page }) => {
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
      await expect(page.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
      await leaveStories(page);
      await backToIntroduction(page);
    }
  });

  test('the illustrated dream globe responds to rotation and keeps the sheet open', async ({ page }, testInfo) => {
    await openDemo(page, 'capture');
    const card = page.getByTestId('component.onboarding.globeCard.1');
    await expect(card).toBeVisible();
    const before = await card.boundingBox();
    await page.getByTestId('btn.onboarding.globe.next').click();
    await expect.poll(async () => Math.abs((await card.boundingBox())!.x - before!.x)).toBeGreaterThan(5);
    await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('globe-rotated.png') });
    await leaveStories(page);
  });

  test('Raconter lets an illustration reveal its journal entry and return to the globe', async ({ page }, testInfo) => {
    await openDemo(page, 'capture');
    const preview = await page.getByTestId('component.onboarding.preview.capture').boundingBox();
    expect(preview!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 49);
    await page.getByTestId('btn.onboarding.globeCard.1').click();
    const entry = page.getByTestId('component.onboarding.dreamEntry');
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Flying over the harbour');
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toHaveCount(0);
    await expect(page.getByTestId('btn.onboarding.feature.close')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('capture-illustrated-entry.png') });
    await page.getByTestId('btn.onboarding.dreamEntry.back').click();
    await expect(entry).toHaveCount(0);
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await expect(page.getByTestId('btn.onboarding.globeCard.1')).toBeFocused();
    await leaveStories(page);
  });

  test('a reduced-motion illustration remains touchable without the globe', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload();
    await openDemo(page, 'capture');
    await page.getByTestId('btn.onboarding.globeCard.0').click();
    await expect(page.getByTestId('component.onboarding.dreamEntry')).toContainText('The staircase');
    await expect(page.getByTestId('btn.onboarding.feature.close')).toBeInViewport({ ratio: 1 });
    await page.getByTestId('btn.onboarding.dreamEntry.back').click();
    await expect(page.getByTestId('component.onboarding.dreamExamples')).toBeVisible();
    await expect(page.getByTestId('btn.onboarding.globeCard.0')).toBeFocused();
    await leaveStories(page);
  });

  test('a small screen with reduced motion can read and close all explanations', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload();
    for (const feature of ['capture', 'connect', 'explore']) {
      await openDemo(page, feature);
      await expect(page.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
      await expectCloseButton(page);
      if (feature === 'capture') {
        await expect(page.getByTestId('component.onboarding.dreamExamples')).toBeVisible();
        await expect(page.getByTestId('btn.onboarding.globe.next')).toHaveCount(0);
      }
      await page.mouse.move(160, 480);
      await page.mouse.wheel(0, 600);
      await expectCloseButton(page);
      await page.screenshot({ path: testInfo.outputPath(`small-reduced-${feature}.png`) });
      await leaveStories(page);
      await backToIntroduction(page);
    }
  });

  test('the constellation example hands the three nights to the reader, one symbol at a time', async ({ page }, testInfo) => {
    await openDemo(page, 'connect');
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    // The example is the chapter's promise, not a replay: no night stepper, all three nights at once.
    await expect(page.getByText('With your dreams.')).toBeVisible();
    await expect(page.getByTestId('btn.onboarding.constellation.previous')).toHaveCount(0);
    await expect(page.getByTestId('btn.onboarding.constellation.next')).toHaveCount(0);
    // The house is the thread: each night tells its own part of it.
    await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('Returns every night');
    await expect(selection).toContainText('Monday · Behind the door, an unknown house.');
    await expect(selection).toContainText('Thursday · It returns, by the water.');
    await expect(selection).toContainText('Saturday · Back again. A cat guards the doorstep.');
    // The other symbols pass once and say something different from the house.
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await expect(selection).toContainText('Only one night');
    await expect(selection).toContainText('Monday · The blue door opens. The house appears.');
    await expect(selection).not.toContainText('Thursday');
    await page.screenshot({ path: testInfo.outputPath('constellation-related-dreams.png') });
    await page.getByTestId('btn.onboarding.constellation.symbol.cat').click();
    await expect(selection).toContainText('First appearance');
    await expect(selection).toContainText('Saturday · A cat waits for you, as if it knew you.');
    await leaveStories(page);
  });


  test('the three stories wait for the reader and turn page by page into their interactive examples', async ({ page }, testInfo) => {
    await page.clock.install();
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(page.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      // Readers found the timed scenes too fast: nothing turns on its own any more.
      await page.clock.runFor(10000);
      await expect(page.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      for (const step of [1, 2, 3]) {
        await page.getByTestId('btn.onboarding.story.next').click();
        await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        if (step === 1 || step === 3) await page.screenshot({ path: testInfo.outputPath(`story-${feature}-${step}.png`) });
        await page.clock.runFor(5000);
      }
      if (feature === 'capture') await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
      // The example waits for the reader: touching the house follows its thread.
      if (feature === 'connect') {
        await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
        await expect(page.getByTestId('component.onboarding.constellation.selection')).toContainText('Returns every night');
      }
      if (feature === 'explore') await expect(page.getByTestId('btn.onboarding.dialogue.home')).toBeVisible();
      await expectCloseButton(page);
      // The installed clock holds every timer: move it on through each transition.
      await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
      await page.clock.runFor(3000);
      await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
      await page.getByTestId('btn.onboarding.back').click();
      await page.clock.runFor(3000);
      await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
    }
  });

  // Product change (owner, 2026-10-24): pages turn both ways. The header's back control
  // returns one page, and from a chapter's first page it reopens the previous chapter's
  // example; the stories' very first page has nothing behind it. A page already read
  // has its button ready at once when the reader comes back to it.
  test('a story turns back page by page and across chapters, and its button waits for the scene', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.capture').click();
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    // The button names what comes next and stays inactive until the scene has told its part.
    const next = page.getByTestId('btn.onboarding.story.next');
    const back = page.getByTestId('btn.onboarding.story.back');
    await expect(next).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(next).toHaveAccessibleName('And on waking?');
    await expect(back).toHaveCount(0);
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.2')).toBeVisible();
    await expect(back).toHaveAccessibleName('Back');
    await back.click();
    await expect(page.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    // Read once, the page does not make the reader wait again: its scene takes more than 2.6 s.
    await expect(next).toBeEnabled({ timeout: 500 });
    // The skip fades out where the button is ready: still in place, no longer taking taps.
    await expect(page.getByTestId('btn.onboarding.story.skip')).toBeDisabled({ timeout: 500 });
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.2')).toBeVisible();
    await next.click();
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.continue').click();
    await expect(page.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
    // Back from the next chapter's first page is the example read just before it.
    await back.click();
    await expect(page.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    for (const step of [2, 1, 0]) {
      await back.click();
      await expect(page.getByTestId(`component.onboarding.story.capture.${step}`)).toBeVisible();
    }
    await expect(back).toHaveCount(0);
    await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
    await leaveStories(page);
  });

  // Product change (owner, 2026-10-24): while a told page's scene plays, the skip turns one
  // page at once; it gives way to the button when it arrives. An example has nothing to skip,
  // except Explorer's unanswered one, where skipping ends the stories through the door.
  test('skipping turns one told page without waiting, and the unanswered Explorer example ends on the path', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.capture').click();
    const next = page.getByTestId('btn.onboarding.story.next');
    const continueButton = page.getByTestId('btn.onboarding.story.continue');
    const skip = page.getByTestId('btn.onboarding.story.skip');
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    // The scene is still telling its part: the button waits, the skip does not.
    await expect(next).toBeDisabled();
    await skip.click();
    await expect(page.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    await expect(page.getByTestId('component.onboarding.story.connect.0')).toHaveCount(0);
    await expect(next).toBeDisabled();
    // Once the button arrives, the skip fades out and no longer takes taps.
    await expect(next).toBeEnabled();
    await expect(skip).toBeDisabled();
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.2')).toBeVisible();
    await next.click();
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    // A chapter's example has nothing to skip: its button is the way on.
    await expect(skip).toHaveCount(0);
    await continueButton.click();
    for (const feature of ['connect', 'explore']) {
      for (const step of [1, 2, 3]) {
        await skip.click();
        await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
      }
      if (feature === 'connect') await continueButton.click();
    }
    // Unanswered, Explorer's example waits for the reader; skipping goes on without an answer.
    await expect(continueButton).toBeDisabled();
    await skip.click();
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
  });

  // Product change (owner, 2026-10-24): "À toi" chooses nothing in advance. The story waits
  // for the reader's answer and Noctalia's reply, and returning to the page asks again.
  test('the Explorer example waits for an answer, then forgets it when the page is turned back', async ({ page }) => {
    await openDemo(page, 'explore');
    const continueButton = page.getByTestId('btn.onboarding.story.continue');
    const followup = page.getByTestId('component.onboarding.dialogue.followup');
    const start = page.getByTestId('btn.onboarding.dialogue.start');
    const home = page.getByTestId('btn.onboarding.dialogue.home');
    const expectUnanswered = async () => {
      await expect(page.getByTestId('component.onboarding.story.explore.3')).toBeVisible();
      await expect(page.getByTestId('text.onboarding.dialogue.question')).toBeVisible();
      for (const choice of [start, home]) {
        await expect(choice).toHaveRole('radio');
        await expect(choice).toHaveAttribute('aria-checked', 'false');
      }
      await expect(followup).toHaveCount(0);
      await expect(page.getByTestId('text.onboarding.dialogue.closing')).toHaveCount(0);
      await expect(continueButton).toBeDisabled();
      // Until the reader answers, the last chapter can still be skipped.
      await expect(page.getByTestId('btn.onboarding.story.skip')).toBeEnabled();
    };
    await expectUnanswered();
    await home.click();
    await expect(home).toHaveAttribute('aria-checked', 'true');
    await expect(start).toHaveAttribute('aria-checked', 'false');
    // Noctalia is still answering: the button waits for the reply and its closing line.
    await expect(continueButton).toBeDisabled();
    await expect(reply(followup, 'What do you miss about that house?')).toBeVisible();
    await expect(page.getByTestId('text.onboarding.dialogue.closing')).toBeVisible();
    await expect(continueButton).toBeEnabled();
    await expect(page.getByTestId('btn.onboarding.story.skip')).toHaveCount(0);
    await page.getByTestId('btn.onboarding.story.back').click();
    await expect(page.getByTestId('component.onboarding.story.explore.2')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.next').click();
    await expectUnanswered();
    await leaveStories(page);
  });

  test('reduced motion makes every story available as manual steps on a small screen', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload();
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      for (const step of [0, 1, 2]) {
        await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        await expectCloseButton(page);
        await page.getByTestId('btn.onboarding.story.next').click();
      }
      await expect(page.getByTestId(`component.onboarding.story.${feature}.3`)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`manual-${feature}.png`) });
      await leaveStories(page);
      await backToIntroduction(page);
    }
  });

  test('the waiting story never replaces the symbol the reader chose', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.connect').click();
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await page.clock.install();
    await page.clock.runFor(8000);
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    await expect(selection).toContainText('Door');
    await expect(selection).toContainText('First appearance');
    await expect(page.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  });

  test('Explorer responds to the personal association selected in the illustrative dialogue', async ({ page }, testInfo) => {
    await openDemo(page, 'explore');
    const followup = page.getByTestId('component.onboarding.dialogue.followup');
    await page.getByTestId('btn.onboarding.dialogue.home').click();
    await expect(reply(followup, 'What do you miss about that house?')).toBeVisible();
    await page.getByTestId('btn.onboarding.dialogue.start').click();
    await expect(reply(followup, 'What would make you want to walk through that door?')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('explore-personal-association.png') });
    await leaveStories(page);
  });


  // Product change (owner, 2026-10-10): the last story ends at the blue door, which opens
  // on the path. Product change (owner, 2026-10-24): the "Start over" link under it is gone.
  test('the three chapters continue in order within the feature sheet and end through the door', async ({ page }, testInfo) => {
    await page.getByTestId('btn.onboarding.feature.capture').click();
    for (const feature of ['capture', 'connect', 'explore']) {
      await expect(page.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      await expectCloseButton(page);
      await readToExample(page, feature);
      // Product change (owner, 2026-10-24): the door opens once the reader has answered.
      if (feature === 'explore') await answerExample(page);
      await page.getByTestId('btn.onboarding.story.continue').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`chapter-${feature}.png`) });
      if (feature === 'explore') {
        await expect(page.getByTestId('btn.onboarding.story.continue')).toContainText('Step through the door');
      }
      await page.getByTestId('btn.onboarding.story.continue').click();
    }
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
  });

  test('Commencer tells the three stories in order, then continues to the path', async ({ page }) => {
    await page.getByTestId('btn.onboarding.intro.next').click();
    for (const feature of ['capture', 'connect', 'explore']) {
      await expect(page.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      await readToExample(page, feature);
      if (feature === 'explore') {
        await answerExample(page);
        await expect(page.getByTestId('btn.onboarding.story.continue')).toContainText('Step through the door');
      }
      await page.getByTestId('btn.onboarding.story.continue').click();
    }
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
  });

  test('closing the stories started by Commencer asks first, moves on, and they are not told twice', async ({ page }) => {
    await page.getByTestId('btn.onboarding.intro.next').click();
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await keepReading(page);
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await leaveStories(page);
    await page.getByTestId('btn.onboarding.back').click();
    await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
    await page.getByTestId('btn.onboarding.intro.next').click();
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  });

  // Layout position only: offsetTop ignores the button's rise into place and the sheet's own motion.
  const footerOffset = (page: Page, id: string) => page.evaluate((testId) => {
    const top = (node: HTMLElement | null) => {
      let y = 0;
      for (let current = node; current; current = current.offsetParent as HTMLElement | null) y += current.offsetTop;
      return y;
    };
    const sheet = document.querySelector<HTMLElement>('[data-testid="sheet.onboarding.feature"]');
    const button = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    return top(button) - top(sheet);
  }, id);

  test('turning a page never moves the button under the thumb', async ({ page }) => {
    const offset = (id: string) => footerOffset(page, id);
    await page.getByTestId('btn.onboarding.feature.capture').click();
    await expectCloseButton(page);
    const next = page.getByTestId('btn.onboarding.story.next');
    await expect(next).toBeEnabled();
    const first = await offset('btn.onboarding.story.next');
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    await expect(next).toBeEnabled();
    expect(Math.abs(await offset('btn.onboarding.story.next') - first)).toBeLessThanOrEqual(1);
    await next.click();
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
    await expect(page.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
    expect(Math.abs(await offset('btn.onboarding.story.continue') - first)).toBeLessThanOrEqual(1);
    await leaveStories(page);
  });

  // The Explorer example waits for an answer: its button keeps the pages' place before it
  // arrives and once it has, so "Step through the door" lands where "Next" was.
  test('the Explorer example keeps the button where the pages had it, before and after the answer', async ({ page }) => {
    const offset = (id: string) => footerOffset(page, id);
    await page.getByTestId('btn.onboarding.feature.explore').click();
    const next = page.getByTestId('btn.onboarding.story.next');
    for (const step of [1, 2]) {
      await next.click();
      await expect(page.getByTestId(`component.onboarding.story.explore.${step}`)).toBeVisible();
    }
    await expect(next).toBeEnabled();
    const told = await offset('btn.onboarding.story.next');
    await next.click();
    await expect(page.getByTestId('component.onboarding.story.explore.3')).toBeVisible();
    expect(Math.abs(await offset('btn.onboarding.story.continue') - told)).toBeLessThanOrEqual(1);
    await answerExample(page);
    expect(Math.abs(await offset('btn.onboarding.story.continue') - told)).toBeLessThanOrEqual(1);
    await leaveStories(page);
  });

  // Product change (owner, 2026-10-24): once answered, the door stays in view where the screen
  // has room for it, smaller, and the closing line still clears the button.
  test('the answered Explorer example keeps its door on a tall screen, above the button', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.reload();
    await openDemo(page, 'explore');
    await answerExample(page);
    const box = (id: string) => page.getByTestId(id).boundingBox();
    await expect.poll(async () => {
      const [door, closing, button] = await Promise.all([
        box('component.onboarding.dialogue.door'), box('text.onboarding.dialogue.closing'), box('btn.onboarding.story.continue'),
      ]);
      return door && closing && button ? { door: door.height >= 48, clearsButton: closing.y + closing.height <= button.y } : null;
    }).toEqual({ door: true, clearsButton: true });
    await leaveStories(page);
  });

});

// The call to action floats over each step. On a short window, the folded iPhone Duo (its
// window less the status bar column) or the smallest iPhone, the step's last element must
// still end above it instead of hiding under it.
const shortWindowTest = createParityTest({ timezoneId: 'Europe/Paris' });
for (const viewport of [{ width: 382, height: 678 }, { width: 375, height: 667 }]) {
  shortWindowTest.use({ viewport });
  shortWindowTest(`at ${viewport.width}x${viewport.height} the call to action covers neither the privacy link nor the last path`, async ({ page }, testInfo) => {
    const gap = (above: string, below: string) => page.evaluate(([aboveId, belowId]) => {
      const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      const [upper, lower] = [rect(aboveId), rect(belowId)];
      return upper && lower ? lower.top - upper.bottom : Number.NEGATIVE_INFINITY;
    }, [above, below]);
    // As openOnboarding does, at this window's size: a fixed theme, then no startup overlay.
    await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+02:00'));
    await page.goto('/');
    await expect(page.getByTestId('btn.onboarding.privacy')).toBeVisible();
    await expect(page.getByText('NOCTALIA', { exact: true })).toHaveCount(0);
    await expect.poll(() => gap('btn.onboarding.privacy', 'btn.onboarding.intro.next')).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: testInfo.outputPath('short-window-welcome.png') });
    await page.getByTestId('btn.onboarding.intro.next').click();
    // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(page);
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
    await expect.poll(() => gap('btn.onboarding.path.dictionary', 'btn.onboarding.primary')).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: testInfo.outputPath('short-window-path.png') });
  });
}
