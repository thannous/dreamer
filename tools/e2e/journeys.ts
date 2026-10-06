import type { App, Screen } from 'e2e';
import { expect } from 'e2e';

export async function meditationJourney(app: App, screen: Screen, nativeIosStack = false) {
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
  await app.restart();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  for (const tab of ['breathe', 'search', 'profile', 'home']) {
    await screen.getByTestId(`tab.${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`screen.${tab}`, { visible: true })).toBeVisible();
  }
  await app.screenshot('tabs-and-persistence');
}
