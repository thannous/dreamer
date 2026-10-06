import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

test('Lucid release requires both intention and experience', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall').tap();
  await screen.scrollUntilVisible(screen.getByTestId('lucid-experience-beginner', { visible: true }));
  await screen.getByTestId('lucid-experience-beginner').tap();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeEnabled();
  await screen.getByTestId('lucid-onboarding-continue', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-sleep-wake-time', { visible: true })).toBeVisible();
  await app.screenshot('release-onboarding-gate');
});

test('Lucid release completes its local plan, persists activation and opens the main tabs', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  const next = screen.getByTestId('lucid-onboarding-continue', { visible: true });
  await expect(next).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.scrollUntilVisible(screen.getByTestId('lucid-experience-beginner', { visible: true }));
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  await next.tap();
  await expect(next).toBeDisabled();
  for (const field of ['lucid-sleep-bedtime', 'lucid-sleep-wake-time']) {
    await screen.getByTestId(field, { visible: true }).tap();
    // Android's system time dialog exposes Done and Cancel as two unnamed buttons.
    const done = /^(Done|Terminé|Listo|Fertig|Fatto)$/;
    if (platform === 'android') {
      await expect(screen.getByText(done, { visible: true })).toBeVisible();
      await expect(screen.getByRole('button', { visible: true })).toHaveCount(2);
      await screen.getByRole('button', { visible: true }).first().tap();
    }
    else await screen.getByRole('button', done, { visible: true }).tap();
  }
  await screen.scrollUntilVisible(screen.getByTestId('lucid-wake-sensitivity-not_sensitive', { visible: true }));
  await screen.getByTestId('lucid-wake-sensitivity-not_sensitive', { visible: true }).tap();
  await expect(next).toBeEnabled();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-plan', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-local-first', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
  await app.restart();
  await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
  for (const tab of ['journal', 'programs', 'progress', 'today']) {
    await screen.getByTestId(`lucid-tab-${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`lucid-${tab}`, { visible: true })).toBeVisible();
  }
  await screen.getByTestId('lucid-tab-night', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  await app.screenshot('release-lucid-activated-tabs');
});
