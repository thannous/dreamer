import type { App, Screen } from 'e2e';
import { expect } from 'e2e';

export async function meditationJourney(app: App, screen: Screen) {
  await screen.getByTestId('btn.welcome.start', { visible: true }).tap();
  await expect(screen.getByTestId('screen.onboarding.breathIntro', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.continue', { visible: true }).tap();
  await expect(screen.getByTestId('btn.onboarding.continue', { visible: true })).toBeDisabled();
  await screen.getByTestId('option.onboarding.goal.sleep', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.continue', { visible: true }).tap();
  await screen.getByTestId('option.onboarding.experience.beginner', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.continue', { visible: true }).tap();
  await expect(screen.getByTestId('screen.onboarding.intention', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.continue', { visible: true }).tap();
  await expect(screen.getByTestId('screen.onboarding.reminder', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.continue', { visible: true }).tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await app.restart();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  for (const tab of ['breathe', 'search', 'profile', 'home']) {
    await screen.getByTestId(`tab.${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`screen.${tab}`, { visible: true })).toBeVisible();
  }
  await app.screenshot('tabs-and-persistence');
}
