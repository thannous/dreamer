import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

test('Dreamer release onboarding reaches capture and rejects an empty save', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('screen.onboarding')).toBeVisible();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  await app.screenshot('release-capture');
});
