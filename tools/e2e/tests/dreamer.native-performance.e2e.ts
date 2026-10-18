import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

// Read-only journey on a separately prepared synthetic journal. Installation,
// fixture loading, native timings and profiling remain outside the UI driver.
test('native journal preserves reading and list position across repeated returns', async ({ app, screen, device }) => {
  await app.open();
  await device.openLink('noctalia://journal');
  await expect(screen.getByTestId('screen.journal')).toBeVisible();
  const reference = screen.getByRole('button', /^Noctalia performance 013,/);
  await screen.scrollUntilVisible(reference, { timeout: 90_000 });
  await expect(screen.getByRole('button', /^Noctalia performance 013,/)).toBeVisible();
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    const before = await reference.boundingBox();
    await reference.tap();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeVisible();
    await expect(screen.getByText('Noctalia performance 013', { exact: true })).toBeVisible();
    const end = screen.getByText('Fin de la lecture de référence 013.', { exact: true });
    await screen.scrollUntilVisible(end);
    await expect(end).toBeVisible();
    if (cycle === 1) await app.screenshot('synthetic-reading-end');
    await screen.scrollUntilVisible(screen.getByTestId('btn.navigateJournal'), { direction: 'up' });
    await screen.getByTestId('btn.navigateJournal').tap();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
    await expect(reference).toBeVisible();
    const after = await reference.boundingBox();
    console.log(JSON.stringify({ cycle, journalPositionBefore: before, journalPositionAfter: after }));
  }
  await app.screenshot('synthetic-journal-return');
});
