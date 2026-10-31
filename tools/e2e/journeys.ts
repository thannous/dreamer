import type { App, Screen } from 'e2e';
import { expect } from 'e2e';

/**
 * Relaunches Méditation. On the iPhone Simulator a tap sent within the first second
 * after the relaunch can reach the app's root view but not the tab under it, with the
 * app already active and the tab bar at its final place (Mac mini runs, 2026-10-31:
 * 12 first taps lost out of 16 on the unchanged app, one as late as 934 ms after the
 * relaunch). The cause in the app is not found; these journeys check what survives a
 * restart, so iOS waits that window out before the first tap.
 */
export async function restartMeditation(app: App, nativeIos: boolean) {
  await app.restart();
  if (nativeIos) await new Promise(resolve => setTimeout(resolve, 1_500));
}

export async function meditationJourney(app: App, screen: Screen, nativeIosStack = false, restart = true) {
  // UIKit keeps the outgoing onboarding scene in its accessibility snapshot.
  // The active navigation scene is last; browser and Android have one CTA.
  const next = () => {
    const locator = screen.getByTestId('btn.onboarding.continue', { visible: true });
    return nativeIosStack ? locator.last() : locator;
  };
  await screen.getByTestId('btn.welcome.start', { visible: true }).tap();
  await expect(screen.getByTestId('screen.onboarding.breathIntro', { visible: true })).toBeVisible();
  await next().tap();
  if (nativeIosStack) await expect(screen.getByTestId('screen.onboarding.goals', { visible: true })).toBeVisible();
  await expect(next()).toBeDisabled();
  await screen.getByTestId('option.onboarding.goal.sleep', { visible: true }).tap();
  await next().tap();
  if (nativeIosStack) await expect(screen.getByTestId('screen.onboarding.experience', { visible: true })).toBeVisible();
  await screen.getByTestId('option.onboarding.experience.beginner', { visible: true }).tap();
  await next().tap();
  await expect(screen.getByTestId('screen.onboarding.intention', { visible: true })).toBeVisible();
  await next().tap();
  await expect(screen.getByTestId('screen.onboarding.reminder', { visible: true })).toBeVisible();
  await next().tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  if (restart) await restartMeditation(app, nativeIosStack);
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  for (const tab of ['breathe', 'search', 'profile', 'home']) {
    await screen.getByTestId(`tab.${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`screen.${tab}`, { visible: true })).toBeVisible();
  }
  await app.screenshot('tabs-and-persistence');
}
