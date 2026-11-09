import type { Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';

export type LucidNativeFixtures = TestFixtures & { device: Device };

export async function activateLucid({ app, screen, platform }: LucidNativeFixtures) {
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
}

// The capture is confirmed by a native alert, which the web build cannot show.
export async function captureWrittenDream({ screen, device, platform }: LucidNativeFixtures, note: string) {
  await screen.getByTestId('lucid-tab-journal', { visible: true }).tap();
  await screen.getByTestId('lucid-journal-capture', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-write', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-recall-text', { visible: true }).fill(note);
  if (platform === 'android') await device.dismissKeyboard();
  await screen.getByTestId('lucid-morning-next', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-cue-not_heard', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-next', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-save', { visible: true }).tap();
  // Android's alert shows its buttons in capitals (« DONE »).
  await screen.getByRole('button', /^(Terminé|Done)$/i, { visible: true }).tap();
  await expect(screen.getByTestId('lucid-morning', { visible: true })).toHaveCount(0);
}
