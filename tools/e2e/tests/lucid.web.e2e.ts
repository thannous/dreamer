import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

test('Lucid requires intention and experience before opening sleep settings', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  const next = screen.getByRole('button', 'Continue', { exact: true });
  await expect(next).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  await expect(next).toBeEnabled();
  await next.tap();
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-sleep-wake-time', { visible: true })).toBeVisible();
  await app.screenshot('sleep-settings');
});
