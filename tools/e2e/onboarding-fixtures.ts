// What the onboarding feature-sheet journeys (tests/dreamer-onboarding-features*.web.e2e.ts) share.
// The engine runs each test file on one worker, so these journeys are split into files that run side by side.
import { expect, withDialog } from './web-parity-fixtures';
import type { Locator, Page } from 'playwright/test';

// Each page's button arrives once its scene has played; click() waits until it is enabled.
export async function readToExample(page: Page, feature: string) {
  for (const step of [1, 2, 3]) {
    await page.getByTestId('btn.onboarding.story.next').click();
    await expect(page.getByTestId(`component.onboarding.story.${feature}.${step}`)).toBeVisible();
  }
}

export async function openDemo(page: Page, feature: string) {
  await page.getByTestId(`btn.onboarding.feature.${feature}`).click();
  await readToExample(page, feature);
}

// Noctalia's reply arrives word by word, spaced by a gap rather than space characters, so
// the DOM text runs the words together; the whole sentence is the reveal's accessible label.
export const reply = (followup: Locator, text: string) => followup.getByLabel(text, { exact: true });

// The Explorer example waits for the reader's answer: Noctalia replies, then the button arrives.
export async function answerExample(page: Page) {
  await page.getByTestId('btn.onboarding.dialogue.home').click();
  await expect(reply(page.getByTestId('component.onboarding.dialogue.followup'), 'What do you miss about that house?')).toBeVisible();
  await expect(page.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
}

// The cross means "I want out": it asks before leaving the introduction for the path.
export async function leaveStories(page: Page) {
  let question = '';
  await withDialog(page, async (dialog) => { question = dialog.message; await dialog.accept(); },
    () => page.getByTestId('btn.onboarding.feature.close').click());
  expect(question).toContain('Leave the introduction?');
  await expect(page.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(page.getByTestId('component.onboarding.path')).toBeVisible();
}

// Declining the question keeps the reader in the story.
export async function keepReading(page: Page) {
  await withDialog(page, 'dismiss', () => page.getByTestId('btn.onboarding.feature.close').click());
  await expect(page.getByTestId('sheet.onboarding.feature')).toBeVisible();
}

export async function backToIntroduction(page: Page) {
  await page.getByTestId('btn.onboarding.back').click();
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
}

export async function expectCloseButton(page: Page) {
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

export async function openOnboarding({ page }: { page: Page }) {
  // The default dynamic theme follows local time; fix it for repeatable captures.
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+02:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('component.onboarding.intro')).toBeVisible();
  // The startup overlay ignores pointer events; wait until it leaves before captures or taps.
  await expect(page.getByText('NOCTALIA', { exact: true })).toHaveCount(0);
}

// Layout position only: offsetTop ignores the button's rise into place and the sheet's own motion.
export const footerOffset = (page: Page, id: string) => page.evaluate((testId) => {
  const top = (node: HTMLElement | null) => {
    let y = 0;
    for (let current = node; current; current = current.offsetParent as HTMLElement | null) y += current.offsetTop;
    return y;
  };
  const sheet = document.querySelector<HTMLElement>('[data-testid="sheet.onboarding.feature"]');
  const button = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  return top(button) - top(sheet);
}, id);
