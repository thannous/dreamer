// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
import { answerExample, expectCloseButton, footerOffset, keepReading, leaveStories, openOnboarding, readToExample } from '../onboarding-fixtures';
const test = createParityTest();

test.use({ timezoneId: 'Europe/Paris' });

test.beforeEach(openOnboarding);

test.describe('feature sheet previews', () => {
  test.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true', 'Feature sheets are switched off for this bundle.');

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
});
