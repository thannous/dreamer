// Shared steps of the Dreamer web journeys, on the SDK surface: each tap and expect is a
// numbered step of trace.md. They start where journeyTest leaves the page, on onboarding.
import type { Browser } from '@e2e-dev/web';
import type { Screen } from 'e2e';
import { expect } from 'e2e';

export type Profile = 'new' | 'existing' | 'plus';

/** Onboarding to Capture as a guest. */
export async function startGuest(screen: Screen, browser: Browser) {
  await expect(screen.getByTestId('screen.onboarding')).toBeVisible();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

/**
 * Home from any tab: the tab bar's, or Capture's own button where the bar is hidden. The tap
 * waits for one of them, as the bar comes back after a closing offer.
 */
export async function openHome(screen: Screen) {
  await screen.getByTestId('tab.home', { visible: true }).or(screen.getByTestId('btn.recording.home', { visible: true })).tap();
  await expect(screen.getByTestId('screen.home')).toBeVisible();
}

/** Every setting, through Home's quick settings. */
export async function openSettings(screen: Screen) {
  await openHome(screen);
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
}

/** A guest who signs in with one of the mock profiles and lands back on Capture. */
export async function selectProfile(screen: Screen, browser: Browser, profile: Profile) {
  await startGuest(screen, browser);
  await openSettings(screen);
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId(`btn.mockProfile.${profile}`).tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

/** The journal: back from a dream, or through the tab bar. */
export async function journal(screen: Screen) {
  const back = screen.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.tap();
  else {
    if (!await screen.getByTestId('tab.journal', { visible: true }).isVisible()) await openHome(screen);
    await screen.getByTestId('tab.journal', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

export const dreamCards = (screen: Screen) => screen.getByTestId(/^dream\.item\./, { visible: true });
export const searchField = (screen: Screen) => screen.getByRole('textbox', 'Search dreams…');

export async function search(screen: Screen, value: string) {
  await searchField(screen).fill(value);
}

/** Finds one dream by its title and opens it on its story. */
export async function openDream(screen: Screen, title: string) {
  await search(screen, title);
  const card = dreamCards(screen).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.tap();
  const story = screen.getByTestId('component.transcriptCard');
  await expect(story).toBeVisible();
  await story.scrollIntoView();
}

/**
 * While the capture seal is struck, the journal asks whether to analyse a new dream when an
 * analysis is available (not for a guest's first dream, analysed at once, nor without allowance).
 * The seal holds until the question is answered.
 */
export async function answerSeal(screen: Screen, answer: 'now' | 'later') {
  const question = screen.getByTestId(answer === 'now' ? 'btn.dreamCaptureSeal.readNow' : 'btn.dreamCaptureSeal.readLater');
  await expect(question).toBeVisible();
  await question.tap();
}
