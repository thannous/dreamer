// What the release-only Dreamer journeys (tests/dreamer-release-*.web.e2e.ts) share. The engine runs
// each test file on one worker, so the former dreamer.web.e2e.ts is split into files that run side by side.
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { fileURLToPath } from 'node:url';
import { aiConsentDisclosure, isolateWeb } from './web-fixtures';

// The mock paints with remote placeholder images, which isolation blocks. Serve one of
// the app's own paintings instead so the landing is deterministic and actually visible.
export const MOCK_PAINTING = fileURLToPath(new URL('../../assets/images/onboarding-reverie-background.webp', import.meta.url));

export async function leaveGuidedStories(browser: Browser, screen: Screen) {
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true') return;
  const unsubscribe = await browser.onDialog('accept');
  try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
  finally { await unsubscribe(); }
}

export async function startGuest(app: App, screen: Screen, browser: Browser) {
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(browser, screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

export async function openQuickSettings(screen: Screen) {
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
}

export async function openSettings(screen: Screen) {
  await openQuickSettings(screen);
  await screen.getByTestId('quick-settings.all', { visible: true }).tap();
}

export async function selectProfile(app: App, screen: Screen, browser: Browser, profile: 'existing' | 'plus') {
  await startGuest(app, screen, browser);
  await openSettings(screen);
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await screen.getByTestId(`btn.mockProfile.${profile}`, { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

// The Noctalia modal asks for AI consent once its host is mounted, as in the app; only the
// onboarding's leave confirmation is still the browser's own dialog.
export async function answerAiConsent(screen: Screen, answer: 'accept' | 'decline') {
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toContainText(aiConsentDisclosure);
  await screen.getByTestId(`btn.aiConsent.${answer}`, { visible: true }).tap();
  await expect(screen.getByTestId('modal.aiConsent')).toHaveCount(0);
}

export async function journal(screen: Screen) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  if (await back.isVisible()) await back.tap();
  else {
    if (!await screen.getByTestId('tab.journal', { visible: true }).isVisible())
      await screen.getByTestId('btn.recording.home', { visible: true }).tap();
    await screen.getByTestId('tab.journal', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

export async function openDream(screen: Screen, title: string) {
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill(title);
  const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toBeVisible();
}

/** Whether the decoded image inside the element with this testID is shown to the reader. */
export function imageShown(browser: Browser, testID: string) {
  return browser.evaluate((id) => {
    const image = document.querySelector(`[data-testid="${id}"] img`) as HTMLImageElement | null;
    return Boolean(image?.complete && image.naturalWidth > 0);
  }, testID);
}

/** Authored entrances only: the waiting loop never settles and is not waited for. */
export async function settledMotion(browser: Parameters<typeof isolateWeb>[0]) {
  await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
}
