import { test, expect } from './fixtures';
import type { Page } from 'playwright/test';

test.use({ timezoneId: 'Europe/Paris' });

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

test.beforeEach(async ({ page }) => {
  // The default dynamic theme follows local time; fix it for repeatable captures.
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+02:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  // The startup overlay ignores pointer events; wait until it leaves before captures or taps.
  await expect(page.getByText('NOCTALIA', { exact: true })).toHaveCount(0);
});

test('feature sheets stay disabled by default while onboarding and privacy remain usable', async ({ page }, testInfo) => {
  test.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true', 'The feature flag is enabled for this bundle.');
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

  test('the constellation accumulates symbols and replays the nights behind a recurring motif', async ({ page }, testInfo) => {
    await openDemo(page, 'connect');
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    // The example opens where the story ended: on Saturday, with all three dreams seen.
    await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('3 nights out of 3');
    await expect(selection).toContainText('Saturday · The cat on the doorstep');
    await expect(page.getByTestId('btn.onboarding.constellation.next')).toBeDisabled();
    await page.getByTestId('btn.onboarding.constellation.previous').click();
    await page.getByTestId('btn.onboarding.constellation.previous').click();
    await expect(selection).toContainText('1 night out of 1');
    await expect(selection).toContainText('Monday · The blue door');
    await page.getByTestId('btn.onboarding.constellation.next').click();
    await expect(selection).toContainText('2 nights out of 2');
    await expect(selection).toContainText('Thursday · The house by the water');
    await page.getByTestId('btn.onboarding.constellation.next').click();
    await expect(selection).toContainText('3 nights out of 3');
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await expect(selection).toContainText('1 night out of 3');
    await expect(selection).not.toContainText('Thursday · The house by the water');
    await page.screenshot({ path: testInfo.outputPath('constellation-related-dreams.png') });
    await page.getByTestId('btn.onboarding.constellation.previous').click();
    await page.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('2 nights out of 2');
    await page.getByTestId('btn.onboarding.feature.close').click();
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
      if (feature === 'connect') await expect(page.getByTestId('component.onboarding.constellation.selection')).toContainText('3 nights out of 3');
      if (feature === 'explore') await expect(page.getByTestId('btn.onboarding.dialogue.home')).toBeVisible();
      await expectCloseButton(page);
      await page.getByTestId('btn.onboarding.feature.close').click();
      await page.clock.runFor(50);
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
    }
  });

  test('a story only moves forward, and its button waits for the scene', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.capture').click();
    await expect(page.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    // The button names what comes next and stays inactive until the scene has told its part.
    const next = page.getByTestId('btn.onboarding.story.next');
    await expect(next).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(next).toHaveAccessibleName('And on waking?');
    // One way through: the close button, not a back link, leaves the story.
    await expect(page.getByTestId('btn.onboarding.story.previous')).toHaveCount(0);
    await readToExample(page, 'capture');
    await expect(page.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await expect(page.getByTestId('btn.onboarding.story.previous')).toHaveCount(0);
    await page.getByTestId('btn.onboarding.feature.close').click();
    await expect(page.getByTestId('btn.onboarding.feature.capture')).toBeFocused();
    await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
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
      await page.getByTestId('btn.onboarding.feature.close').click();
      await expect(page.getByTestId(`btn.onboarding.feature.${feature}`)).toBeFocused();
    }
  });

  test('the waiting story never replaces the symbol the reader chose', async ({ page }) => {
    await page.getByTestId('btn.onboarding.feature.connect').click();
    await page.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await page.clock.install();
    await page.clock.runFor(8000);
    const selection = page.getByTestId('component.onboarding.constellation.selection');
    await expect(selection).toContainText('Door');
    await expect(selection).toContainText('1 night out of 1');
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
      await readToExample(page, feature);
      await page.getByTestId('btn.onboarding.story.continue').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`chapter-${feature}.png`) });
      await page.getByTestId('btn.onboarding.story.continue').click();
    }
    await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(page.getByTestId('btn.onboarding.feature.explore')).toBeFocused();
    await page.getByTestId('btn.onboarding.intro.next').click();
    await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
  });

  test('turning a page never moves the button under the thumb', async ({ page }) => {
    // Layout position only: offsetTop ignores the button's rise into place and the sheet's own motion.
    const offset = (id: string) => page.evaluate((testId) => {
      const top = (node: HTMLElement | null) => {
        let y = 0;
        for (let current = node; current; current = current.offsetParent as HTMLElement | null) y += current.offsetTop;
        return y;
      };
      const sheet = document.querySelector<HTMLElement>('[data-testid="sheet.onboarding.feature"]');
      const button = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      return top(button) - top(sheet);
    }, id);
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
    await page.getByTestId('btn.onboarding.feature.close').click();
  });

});
