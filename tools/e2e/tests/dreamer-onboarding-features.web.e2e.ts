// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect } from '../web-parity-fixtures';
import { backToIntroduction, expectCloseButton, keepReading, leaveStories, openDemo, openOnboarding } from '../onboarding-fixtures';
const test = createParityTest();
const defaultFeatureTest = createParityTest();

test.use({ timezoneId: 'Europe/Paris' });
defaultFeatureTest.use({ timezoneId: 'Europe/Paris' });

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
