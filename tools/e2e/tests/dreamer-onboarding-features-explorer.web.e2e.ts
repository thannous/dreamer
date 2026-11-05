// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect } from '../web-parity-fixtures';
import { answerExample, footerOffset, leaveStories, openDemo, openOnboarding, reply } from '../onboarding-fixtures';
const test = createParityTest();

test.use({ timezoneId: 'Europe/Paris' });

test.beforeEach(openOnboarding);

test.describe('feature sheet previews', () => {
  test.skip(process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true', 'Feature sheets are switched off for this bundle.');

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
