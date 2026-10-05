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

test('the onboarding story bridges capture to understanding and exploration', {
  skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true'
    ? 'Feature presentations require an explicit opt-in bundle.' : false,
}, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.feature.capture').tap();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await expect(screen.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
  await screen.getByTestId('btn.onboarding.globeCard.1').tap();
  await expect(screen.getByTestId('component.onboarding.dreamEntry')).toContainText('Flying over the harbour');
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByText('Once your dream is saved…')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByText('you can find the details that return…')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByText('and discover what connects your nights.')).toBeVisible();
  await app.screenshot('capture-story-bridge');
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.explore.0')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(screen.getByTestId('component.onboarding.intro')).toBeVisible();
  await app.screenshot('onboarding-story-complete');
});
