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

test('Quick Settings changes language and theme without losing the Capture draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  const draft = 'Fixture : un phare bleu au-dessus d’une mer calme.';
  await editor.fill(draft);
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true });
  // A closed drawer must not expose interactive preferences to assistive technology.
  await expect(screen.getByRole('radio')).toHaveCount(0);
  await settings.tap();
  await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  const french = screen.getByTestId('quick-settings.language.fr', { visible: true });
  await french.tap();
  await expect(french).toHaveAttribute('aria-checked', 'true');
  await screen.getByTestId('quick-settings.close', { visible: true }).tap();
  await expect(screen.getByRole('radio')).toHaveCount(0);
  await expect(screen.getByTestId('btn.recording.inputMode.text', { visible: true })).toContainText('Écrire');
  for (const [theme, background] of [['dark', 'rgb(20, 19, 26)'], ['light', 'rgb(245, 234, 219)']]) {
    await browser.setViewport({ width: theme === 'dark' ? 390 : 1280, height: 844 });
    // Desktop Capture returns to Today for the Settings control.
    if (theme === 'light') {
      await screen.getByTestId('btn.recording.home', { visible: true }).tap();
      await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    } else await settings.tap();
    await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
    const choice = screen.getByTestId(`quick-settings.theme.${theme}`, { visible: true });
    await expect(choice).toBeEnabled();
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-checked', 'true');
    await screen.getByTestId('quick-settings.close', { visible: true }).tap();
    await expect(screen.getByRole('radio')).toHaveCount(0);
    if (theme === 'light') await screen.getByTestId('btn.home.today.cta', { visible: true }).tap();
    await expect.poll(() => browser.evaluate(() => {
      const input = document.querySelector('[data-testid="input.dreamTranscript"]');
      return input ? getComputedStyle(input).backgroundColor : null;
    })).toBe(background);
    await expect(editor).toHaveValue(draft);
    await app.screenshot(`quick-settings-${theme}`);
  }
  await browser.reload();
  await expect(screen.getByTestId('btn.recording.inputMode.text', { visible: true })).toContainText('Écrire');
  await expect(editor).toHaveValue(draft);
  await app.screenshot('quick-settings-persisted-after-reload');
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
