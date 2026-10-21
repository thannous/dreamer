import { readDOM, byId, expectInViewport, setTestDate, observeElapsed, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import { test as webTest } from '@e2e-dev/web';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ setup: openOnboarding });
const defaultFeatureTest = createExactWebTest({ setup: openOnboarding, skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true' });



// Each page's button arrives once its scene has played; click() waits until it is enabled.
async function readToExample(ui: ExactWebUI, feature: string) {
  const { screen: uiScreen } = ui;
  for (const step of [1, 2, 3]) {
    await uiScreen.getByTestId('btn.onboarding.story.next').click();
    await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
  }
}

async function openDemo(ui: ExactWebUI, feature: string) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId(`btn.onboarding.feature.${feature}`).click();
  await readToExample(ui, feature);
}

// The cross means "I want out": it asks before leaving the introduction for the path.
async function leaveStories(ui: ExactWebUI) {
  const { screen: uiScreen, browser } = ui;
  let question = '';
  await withExactDialog(browser, async (dialog) => { question = dialog.message; await dialog.accept(); },
    () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  expect(question).toContain('Leave the introduction?');
  await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
}

// Declining the question keeps the reader in the story.
async function keepReading(ui: ExactWebUI) {
  const { screen: uiScreen, browser } = ui;
  await withExactDialog(browser, 'dismiss', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toBeVisible();
}

async function backToIntroduction(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId('btn.onboarding.back').click();
  await expect(uiScreen.getByTestId('component.onboarding.intro')).toBeVisible();
}

async function expectCloseButton(ui: ExactWebUI) {
  const { screen: uiScreen, browser } = ui;
  const close = uiScreen.getByTestId('btn.onboarding.feature.close');
  await expect(close).toHaveAttribute('role', 'button');
  await expect(close).toHaveAccessibleName('Close');
  // Capture the settled sheet, including its body, rather than a frame mid-open.
  await readDOM(browser, byId('btn.onboarding.feature.close'), async (node) => {
    const drawer = node.closest('[role="dialog"]');
    if (drawer) await Promise.all(drawer.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  await expectInViewport(close, browser, 1);
  await expect(uiScreen.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
  // Read both rectangles in one frame while the existing drawer animation runs.
  const bounds = await readDOM(browser, byId('btn.onboarding.feature.close'), (node) => {
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

async function openOnboarding(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  // The default dynamic theme follows local time; fix it for repeatable captures.
  await setTestDate(browser, '2026-10-02T12:00:00+02:00');
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/');
  await expect(uiScreen.getByTestId('component.onboarding.intro')).toBeVisible();
  // The startup overlay ignores pointer events; wait until it leaves before captures or taps.
  await expect(uiScreen.getByText('NOCTALIA', { exact: true })).toHaveCount(0);
}


// This OFF-only case is excluded during collection before an ON bundle opens.

defaultFeatureTest('feature sheets stay disabled when switched off while onboarding and privacy remain usable', async (ui) => {
  const { app, screen: uiScreen } = ui;
  for (const feature of ['capture', 'connect', 'explore']) {
    const signal = uiScreen.getByTestId(`btn.onboarding.feature.${feature}`);
    await expect(signal).toBeVisible();
    expect(await signal.getAttribute('role')).not.toBe('button');
    await signal.click();
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  }
  await app.screenshot('feature-sheets-disabled.png');
  await uiScreen.getByTestId('btn.onboarding.privacy').click();
  await expect(uiScreen.getByTestId('sheet.onboarding.privacy')).toBeVisible();
  await uiScreen.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(uiScreen.getByTestId('sheet.onboarding.privacy')).toHaveCount(0);
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(ui);
  await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
});

test('the chosen path is announced as selected and survives a return to the introduction', async (ui) => {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(ui);
  const memory = uiScreen.getByTestId('btn.onboarding.path.memory');
  await memory.click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
  await expect(uiScreen.getByTestId('btn.onboarding.path.analyze')).toHaveAttribute('aria-checked', 'false');
  await uiScreen.getByTestId('btn.onboarding.back').click();
  await expect(uiScreen.getByTestId('component.onboarding.intro')).toBeVisible();
  // The stories are told once: returning to the introduction goes straight back to the path.
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  await expect(memory).toHaveAttribute('aria-checked', 'true');
});

test('the welcome and path remain inside the viewport without off-canvas horizontal overflow', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  const overflow = () => browser.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; leaving them by the cross is confirmed.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await leaveStories(ui);
  await uiScreen.getByTestId('btn.onboarding.path.memory').click();
  await expect(uiScreen.getByTestId('btn.onboarding.path.memory')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  const position = await uiScreen.getByTestId('screen.onboarding').boundingBox();
  expect(position!.x).toBeGreaterThanOrEqual(0);
  await app.screenshot('path-within-viewport.png');
});

webTest.describe('feature sheet previews', { skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true' }, () => {

  for (const theme of ['light', 'dark'] as const) {
    // Product change (owner, 2026-10-10): the cross means leaving the introduction. It asks
    // first, and leaving goes on to the path instead of back to the introduction.
    test(`each story's top-right cross asks before leaving the introduction in ${theme} theme`, async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
      if (theme === 'dark') {
        await setTestDate(browser, '2026-10-02T23:00:00+02:00');
        await browser.reload();
      }
      for (const feature of ['capture', 'connect', 'explore']) {
        await uiScreen.getByTestId(`btn.onboarding.feature.${feature}`).click();
        await expect(uiScreen.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
        await expectCloseButton(ui);
        await app.screenshot(`${theme}-${feature}.png`);
        await keepReading(ui);
        await expect(uiScreen.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
        await leaveStories(ui);
        await backToIntroduction(ui);
      }
      // Once left, the stories are not told again: Commencer goes straight to the path.
      await uiScreen.getByTestId('btn.onboarding.intro.next').click();
      await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
    });
  }

  // Product change (owner, 2026-10-10): only the cross ends a story, so no stray key or
  // swipe can close it by accident.
  test('Escape keeps a story open; only the cross leaves it', async (ui) => {
  const { screen: uiScreen, browser } = ui;
    for (const feature of ['capture', 'connect', 'explore']) {
      await uiScreen.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toBeVisible();
      await browser.keyboard.press('Escape');
      await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toBeVisible();
      await expect(uiScreen.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
      await leaveStories(ui);
      await backToIntroduction(ui);
    }
  });

  test('the illustrated dream globe responds to rotation and keeps the sheet open', async (ui) => {
  const { app, screen: uiScreen } = ui;
    await openDemo(ui, 'capture');
    const card = uiScreen.getByTestId('component.onboarding.globeCard.1');
    await expect(card).toBeVisible();
    const before = await card.boundingBox();
    await uiScreen.getByTestId('btn.onboarding.globe.next').click();
    await expect.poll(async () => Math.abs((await card.boundingBox())!.x - before!.x)).toBeGreaterThan(5);
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toBeVisible();
    await app.screenshot('globe-rotated.png');
    await leaveStories(ui);
  });

  test('Raconter lets an illustration reveal its journal entry and return to the globe', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    await openDemo(ui, 'capture');
    const preview = await uiScreen.getByTestId('component.onboarding.preview.capture').boundingBox();
    expect(preview!.width).toBeGreaterThanOrEqual((await browser.evaluate(() => innerWidth)) - 49);
    await uiScreen.getByTestId('btn.onboarding.globeCard.1').click();
    const entry = uiScreen.getByTestId('component.onboarding.dreamEntry');
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Flying over the harbour');
    await expect(uiScreen.getByTestId('component.onboarding.dreamGlobe')).toHaveCount(0);
    await expectInViewport(uiScreen.getByTestId('btn.onboarding.feature.close'), browser, 1);
    await app.screenshot('capture-illustrated-entry.png');
    await uiScreen.getByTestId('btn.onboarding.dreamEntry.back').click();
    await expect(entry).toHaveCount(0);
    await expect(uiScreen.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await expect(uiScreen.getByTestId('btn.onboarding.globeCard.1')).toBeFocused();
    await leaveStories(ui);
  });

  test('a reduced-motion illustration remains touchable without the globe', async (ui) => {
  const { screen: uiScreen, browser } = ui;
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await browser.setViewport({ width: 320, height: 568 });
    await browser.reload();
    await openDemo(ui, 'capture');
    await uiScreen.getByTestId('btn.onboarding.globeCard.0').click();
    await expect(uiScreen.getByTestId('component.onboarding.dreamEntry')).toContainText('The staircase');
    await expectInViewport(uiScreen.getByTestId('btn.onboarding.feature.close'), browser, 1);
    await uiScreen.getByTestId('btn.onboarding.dreamEntry.back').click();
    await expect(uiScreen.getByTestId('component.onboarding.dreamExamples')).toBeVisible();
    await expect(uiScreen.getByTestId('btn.onboarding.globeCard.0')).toBeFocused();
    await leaveStories(ui);
  });

  test('a small screen with reduced motion can read and close all explanations', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await browser.setViewport({ width: 320, height: 568 });
    await browser.reload();
    for (const feature of ['capture', 'connect', 'explore']) {
      await openDemo(ui, feature);
      await expect(uiScreen.getByTestId(`component.onboarding.preview.${feature}`)).toBeVisible();
      await expectCloseButton(ui);
      if (feature === 'capture') {
        await expect(uiScreen.getByTestId('component.onboarding.dreamExamples')).toBeVisible();
        await expect(uiScreen.getByTestId('btn.onboarding.globe.next')).toHaveCount(0);
      }
      await browser.mouse.move(160, 480);
      await browser.mouse.wheel(0, 600);
      await expectCloseButton(ui);
      await app.screenshot(`small-reduced-${feature}.png`);
      await leaveStories(ui);
      await backToIntroduction(ui);
    }
  });

  test('the constellation example hands the three nights to the reader, one symbol at a time', async (ui) => {
  const { app, screen: uiScreen } = ui;
    await openDemo(ui, 'connect');
    const selection = uiScreen.getByTestId('component.onboarding.constellation.selection');
    // The example is the chapter's promise, not a replay: no night stepper, all three nights at once.
    await expect(uiScreen.getByText('With your dreams.')).toBeVisible();
    await expect(uiScreen.getByTestId('btn.onboarding.constellation.previous')).toHaveCount(0);
    await expect(uiScreen.getByTestId('btn.onboarding.constellation.next')).toHaveCount(0);
    // The house is the thread: each night tells its own part of it.
    await uiScreen.getByTestId('btn.onboarding.constellation.symbol.house').click();
    await expect(selection).toContainText('Returns every night');
    await expect(selection).toContainText('Monday · Behind the door, an unknown house.');
    await expect(selection).toContainText('Thursday · It returns, by the water.');
    await expect(selection).toContainText('Saturday · Back again. A cat guards the doorstep.');
    // The other symbols pass once and say something different from the house.
    await uiScreen.getByTestId('btn.onboarding.constellation.symbol.door').click();
    await expect(selection).toContainText('Only one night');
    await expect(selection).toContainText('Monday · The blue door opens. The house appears.');
    await expect(selection).not.toContainText('Thursday');
    await app.screenshot('constellation-related-dreams.png');
    await uiScreen.getByTestId('btn.onboarding.constellation.symbol.cat').click();
    await expect(selection).toContainText('First appearance');
    await expect(selection).toContainText('Saturday · A cat waits for you, as if it knew you.');
    await leaveStories(ui);
  });

  test('the three stories wait for the reader and turn page by page into their interactive examples', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    // Observe real timers; no private engine clock or accelerated timer bridge.
    for (const feature of ['capture', 'connect', 'explore']) {
      await uiScreen.getByTestId(`btn.onboarding.feature.${feature}`).click();
      await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      // Readers found the timed scenes too fast: nothing turns on its own any more.
      await observeElapsed(browser, 10000);
      await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      for (const step of [1, 2, 3]) {
        await uiScreen.getByTestId('btn.onboarding.story.next').click();
        await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        if (step === 1 || step === 3) await app.screenshot(`story-${feature}-${step}.png`);
        await observeElapsed(browser, 5000);
      }
      if (feature === 'capture') await expect(uiScreen.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
      // The example waits for the reader: touching the house follows its thread.
      if (feature === 'connect') {
        await uiScreen.getByTestId('btn.onboarding.constellation.symbol.house').click();
        await expect(uiScreen.getByTestId('component.onboarding.constellation.selection')).toContainText('Returns every night');
      }
      if (feature === 'explore') await expect(uiScreen.getByTestId('btn.onboarding.dialogue.home')).toBeVisible();
      await expectCloseButton(ui);
      // Observe the complete real transition before checking its destination.
      await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
      await observeElapsed(browser, 3000);
      await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
      await uiScreen.getByTestId('btn.onboarding.back').click();
      await observeElapsed(browser, 3000);
      await expect(uiScreen.getByTestId('component.onboarding.intro')).toBeVisible();
    }
  });

  test('a story only moves forward, and its button waits for the scene', async (ui) => {
  const { screen: uiScreen } = ui;
    await uiScreen.getByTestId('btn.onboarding.feature.capture').click();
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    // The button names what comes next and stays inactive until the scene has told its part.
    const next = uiScreen.getByTestId('btn.onboarding.story.next');
    await expect(next).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(next).toHaveAccessibleName('And on waking?');
    // One way through: the close button, not a back link, leaves the story.
    await expect(uiScreen.getByTestId('btn.onboarding.story.previous')).toHaveCount(0);
    await readToExample(ui, 'capture');
    await expect(uiScreen.getByTestId('component.onboarding.dreamGlobe')).toBeVisible();
    await expect(uiScreen.getByTestId('btn.onboarding.story.previous')).toHaveCount(0);
    await leaveStories(ui);
  });

  test('reduced motion makes every story available as manual steps on a small screen', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await browser.setViewport({ width: 320, height: 568 });
    await browser.reload();
    for (const feature of ['capture', 'connect', 'explore']) {
      await uiScreen.getByTestId(`btn.onboarding.feature.${feature}`).click();
      for (const step of [0, 1, 2]) {
        await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
        await expectCloseButton(ui);
        await uiScreen.getByTestId('btn.onboarding.story.next').click();
      }
      await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.3`)).toBeVisible();
      await app.screenshot(`manual-${feature}.png`);
      await leaveStories(ui);
      await backToIntroduction(ui);
    }
  });

  test('the waiting story never replaces the symbol the reader chose', async (ui) => {
  const { screen: uiScreen, browser } = ui;
    await uiScreen.getByTestId('btn.onboarding.feature.connect').click();
    await uiScreen.getByTestId('btn.onboarding.constellation.symbol.door').click();
    // Observe real timers; no private engine clock or accelerated timer bridge.
    await observeElapsed(browser, 8000);
    const selection = uiScreen.getByTestId('component.onboarding.constellation.selection');
    await expect(selection).toContainText('Door');
    await expect(selection).toContainText('First appearance');
    await expect(uiScreen.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  });

  test('Explorer responds to the personal association selected in the illustrative dialogue', async (ui) => {
  const { app, screen: uiScreen } = ui;
    await openDemo(ui, 'explore');
    const followup = uiScreen.getByTestId('component.onboarding.dialogue.followup');
    await uiScreen.getByTestId('btn.onboarding.dialogue.home').click();
    await expect(followup).toContainText('What do you miss about that house?');
    await uiScreen.getByTestId('btn.onboarding.dialogue.start').click();
    await expect(followup).toContainText('What would make you want to walk through that door?');
    await app.screenshot('explore-personal-association.png');
    await leaveStories(ui);
  });

  // Product change (owner, 2026-10-10): the last story ends at the blue door, which opens
  // on the path, with a way to start the stories over.
  test('the three chapters continue in order within the feature sheet and end through the door', async (ui) => {
  const { app, screen: uiScreen } = ui;
    await uiScreen.getByTestId('btn.onboarding.feature.capture').click();
    for (const feature of ['capture', 'connect', 'explore']) {
      await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      await expectCloseButton(ui);
      await readToExample(ui, feature);
      await uiScreen.getByTestId('btn.onboarding.story.continue').scrollIntoView();
      await app.screenshot(`chapter-${feature}.png`);
      if (feature === 'explore') {
        await expect(uiScreen.getByTestId('btn.onboarding.story.continue')).toContainText('Step through the door');
        await expect(uiScreen.getByTestId('btn.onboarding.story.restart')).toContainText('Start over');
      } else {
        await expect(uiScreen.getByTestId('btn.onboarding.story.restart')).toHaveCount(0);
      }
      await uiScreen.getByTestId('btn.onboarding.story.continue').click();
    }
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
  });

  test('starting over from the last story returns to the first one', async (ui) => {
  const { screen: uiScreen } = ui;
    await uiScreen.getByTestId('btn.onboarding.feature.explore').click();
    await readToExample(ui, 'explore');
    await uiScreen.getByTestId('btn.onboarding.story.restart').click();
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toBeVisible();
  });

  test('Commencer tells the three stories in order, then continues to the path', async (ui) => {
  const { screen: uiScreen } = ui;
    await uiScreen.getByTestId('btn.onboarding.intro.next').click();
    for (const feature of ['capture', 'connect', 'explore']) {
      await expect(uiScreen.getByTestId(`component.onboarding.story.${feature}.0`)).toBeVisible();
      await readToExample(ui, feature);
      if (feature === 'explore') await expect(uiScreen.getByTestId('btn.onboarding.story.continue')).toContainText('Step through the door');
      await uiScreen.getByTestId('btn.onboarding.story.continue').click();
    }
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
    await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
  });

  test('closing the stories started by Commencer asks first, moves on, and they are not told twice', async (ui) => {
  const { screen: uiScreen } = ui;
    await uiScreen.getByTestId('btn.onboarding.intro.next').click();
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await keepReading(ui);
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.0')).toBeVisible();
    await leaveStories(ui);
    await uiScreen.getByTestId('btn.onboarding.back').click();
    await expect(uiScreen.getByTestId('component.onboarding.intro')).toBeVisible();
    await uiScreen.getByTestId('btn.onboarding.intro.next').click();
    await expect(uiScreen.getByTestId('component.onboarding.path')).toBeVisible();
    await expect(uiScreen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  });

  test('turning a page never moves the button under the thumb', async (ui) => {
  const { screen: uiScreen, browser } = ui;
    // Layout position only: offsetTop ignores the button's rise into place and the sheet's own motion.
    const offset = (id: string) => browser.evaluate((testId) => {
      const top = (node: HTMLElement | null) => {
        let y = 0;
        for (let current = node; current; current = current.offsetParent as HTMLElement | null) y += current.offsetTop;
        return y;
      };
      const sheet = document.querySelector<HTMLElement>('[data-testid="sheet.onboarding.feature"]');
      const button = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      return top(button) - top(sheet);
    }, id);
    await uiScreen.getByTestId('btn.onboarding.feature.capture').click();
    await expectCloseButton(ui);
    const next = uiScreen.getByTestId('btn.onboarding.story.next');
    await expect(next).toBeEnabled();
    const first = await offset('btn.onboarding.story.next');
    await next.click();
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.1')).toBeVisible();
    await expect(next).toBeEnabled();
    expect(Math.abs(await offset('btn.onboarding.story.next') - first)).toBeLessThanOrEqual(1);
    await next.click();
    await next.click();
    await expect(uiScreen.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
    await expect(uiScreen.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
    expect(Math.abs(await offset('btn.onboarding.story.continue') - first)).toBeLessThanOrEqual(1);
    await leaveStories(ui);
  });

});
