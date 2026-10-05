import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

test('onboarding prevents an empty save and capture preserves the draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  const story = 'E2E lighthouse above a quiet sea.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.recording.inputMode.voice').tap();
  await screen.getByTestId('btn.recording.inputMode.text').tap();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('draft-preserved');
});
