import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

test('Lucid release requires both intention and experience', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall').tap();
  await screen.getByTestId('lucid-experience-beginner').tap();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeEnabled();
  await app.screenshot('release-onboarding-gate');
});
