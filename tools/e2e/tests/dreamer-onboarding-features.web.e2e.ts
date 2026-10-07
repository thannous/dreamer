// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect } from '../web-parity-fixtures';
import type { Page } from 'playwright/test';
const test = createParityTest();
const defaultFeatureTest = createParityTest();

test.use({ timezoneId: 'Europe/Paris' });
defaultFeatureTest.use({ timezoneId: 'Europe/Paris' });

async function openDemo(page: Page, feature: string) {
  await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
  await page.getByTestId('btn.onboarding.story.skip').click();
  await expect(page.getByTestId(`component.onboarding.story.${feature}.3`)).toBeVisible();
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
defaultFeatureTest('feature sheets stay disabled by default while onboarding and privacy remain usable', async ({ page }, testInfo) => {
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
  await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
});

test('the chosen path is announced as selected and survives a return to the introduction', async ({ page }) => {
  await page.getByTestId('btn.onboarding.intro.next').click();
  const memory = page.getByTestId('btn.onboarding.path.memory');
  await memory.click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('btn.onboarding.path.analyze')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('btn.onboarding.back').click();
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  await page.getByTestId('btn.onboarding.intro.next').click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
});

test('the welcome and path remain inside the viewport without off-canvas horizontal overflow', async ({ page }, testInfo) => {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.path.memory').click();
  await expect(page.getByTestId('btn.onboarding.path.memory')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  const position = await page.getByTestId('screen.onboarding').boundingBox();
  expect(position!.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('path-within-viewport.png') });
});

test.describe('feature sheet previews', () => {
  test.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true', 'Feature sheets require explicit opt-in.');

  for (const theme of ['light', 'dark'] as const) {
    test(`each promise closes with the top-right cross and restores focus in ${theme} theme`, async ({ page }, testInfo) => {
      if (theme === 'dark') {
        await page.clock.setFixedTime(new Date('2026-10-02T23:00:00+02:00'));
        await page.reload();
      }
      for (const feature of ['capture', 'connect', 'explore']) {
        await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
        await expect(page.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
        await expectCloseButton(page);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${feature}.png`) });
        await page.getByTestId('btn.onboarding.feature.close').click();
        await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
        await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
        await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
      }
      await page.getByTestId('btn.onboarding.intro.next').click();
      await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
    });
  }

  test('Escape dismisses the explanation without skipping onboarding', async ({ page }) => {
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
    }
    await expect(page.getByTestId('btn.onboarding.intro.next')).toBeVisible();
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
    await page.getByTestId('btn.onboarding.feature.close').click();
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
    await page.getByTestId('btn.onboarding.feature.close').click();
    await expect(page.getByTestId('btn.onboarding.feature.capture')).toBeFocused();
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
    await page.getByTestId('btn.onboarding.feature.close').click();
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
      await page.getByTestId('btn.onboarding.feature.close').click();
      await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
      await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
    }
  });

  test('the constellation accumulates symbols and shows the dreams behind a recurring motif', async ({ page }, testInfo) => {
    await openDemo(page, 'connect');
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('1/1');
    await expect(selection).toContainText('The staircase');
    await page.getByTestId('btn.onboarding.constellation.next').click();
    await expect(selection).toContainText('2/2');
    await expect(selection).toContainText('The tide');
    await page.getByTestId('btn.onboarding.constellation.next').click();
    await expect(selection).toContainText('3/3');
    await expect(selection).toContainText('A cat');
    await expect(page.getByTestId('btn.onboarding.constellation.next')).toBeDisabled();
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await expect(selection).toContainText('1/3');
    await expect(selection).not.toContainText('The tide');
    await page.screenshot({ path: testInfo.outputPath('constellation-related-dreams.png') });
    await page.getByTestId('btn.onboarding.constellation.previous').click();
    await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('2/2');
    await page.getByTestId('btn.onboarding.feature.close').click();
  });


  test('the three motion stories advance manually in order to their interactive examples', async ({ page }, testInfo) => {
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      for (const step of [0, 1, 2, 3]) {
        await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        if (step === 1 || step === 3) await page.screenshot({ path: testInfo.outputPath(`story-${feature}-${step}.png`) });
        if (step < 3) await page.getByTestId('btn.onboarding.story.next').click();
      }
      if (feature === 'capture') await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
      if (feature === 'connect') await expect(page.getByTestId('component.onboarding.constellation.selection')).toContainText('3/3');
      if (feature === 'explore') await expect(page.getByTestId('btn.onboarding.dialogue.home')).toBeVisible();
      await expectCloseButton(page);
      await page.getByTestId('btn.onboarding.feature.close').click();
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
    }
  });

  test('a story waits for the reader and supports going back, skipping and replaying', async ({ page }) => {
    await page.clock.install();
    await page.getByTestId('btn.onboarding.feature.capture').click();
    await expect(page.getByTestId('btn.onboarding.story.play')).toHaveCount(0);
    await page.clock.runFor(8000);
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.next').click();
    await expect(page.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.previous').click();
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.skip').click();
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await page.getByTestId('btn.onboarding.story.replay').click();
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await page.getByTestId('btn.onboarding.feature.close').click();
    await page.clock.runFor(50);
    await expect(page.getByTestId('btn.onboarding.feature.capture')).toBeFocused();
    await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  });

  test('reduced motion makes every story available as manual steps on a small screen', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload();
    for (const feature of ['capture', 'connect', 'explore']) {
      await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(page.getByTestId('btn.onboarding.story.play')).toHaveCount(0);
      for (const step of [0, 1, 2]) {
        await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        await expectCloseButton(page);
        await page.getByTestId('btn.onboarding.story.next').click();
      }
      await expect(page.getByTestId(`component.onboarding.story.${feature}.3`)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`manual-${feature}.png`) });
      await page.getByTestId('btn.onboarding.feature.close').click();
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
    }
  });

  test('touching the constellation stops the story before it can replace the chosen symbol', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.connect').click();
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await page.clock.install();
    await page.clock.runFor(8000);
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    await expect(selection).toContainText('Door');
    await expect(selection).toContainText('1/1');
    await expect(page.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  });

  test('Explorer responds to the personal association selected in the illustrative dialogue', async ({ page }, testInfo) => {
    await openDemo(page, 'explore');
    const followup = page.getByTestId('component.onboarding.dialogue.followup');
    await page.getByTestId('btn.onboarding.dialogue.home').click();
    await expect(followup).toContainText('What do you miss about that house?');
    await page.getByTestId('btn.onboarding.dialogue.start').click();
    await expect(followup).toContainText('What would make you want to walk through that door?');
    await page.screenshot({ path: testInfo.outputPath('explore-personal-association.png') });
    await page.getByTestId('btn.onboarding.feature.close').click();
    await expect(page.getByTestId('btn.onboarding.feature.explore')).toBeFocused();
  });


  test('the three chapters continue in order within the feature sheet and return to onboarding', async ({ page }, testInfo) => {
    await page.getByTestId('btn.onboarding.feature.capture').click();
    for (const feature of ['capture', 'connect', 'explore']) {
      await expect(page.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      await expectCloseButton(page);
      await page.getByTestId('btn.onboarding.story.skip').click();
      await expect(page.getByTestId(`component.onboarding.story.${feature}.3`)).toBeVisible();
      await page.getByTestId('btn.onboarding.story.continue').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`chapter-${feature}.png`) });
      await page.getByTestId('btn.onboarding.story.continue').click();
      if (feature === 'capture') {
        for (const step of [0, 1, 2]) {
          await expect(page.getByTestId(`component.onboarding.transition.${step}`)).toBeVisible();
          await page.getByTestId('btn.onboarding.story.next').click();
        }
      }
    }
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(page.getByTestId('btn.onboarding.feature.explore')).toBeFocused();
    await page.getByTestId('btn.onboarding.intro.next').click();
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
  });

});
