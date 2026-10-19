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
    // A small upward scroll reveals the return outside the scroll view. Bringing
    // the running head barely into view can leave its centre under iOS's status bar:
    // a coordinate tap there scrolls to the top instead of activating Back.
    await screen.swipe({ direction: 'up', momentum: 'none' });
    const back = screen.getByTestId('journal.detail.returnTab');
    await expect(back).toBeVisible();
    await back.tap();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
    await expect(reference).toBeVisible();
    const after = await reference.boundingBox();
    console.log(JSON.stringify({ cycle, journalPositionBefore: before, journalPositionAfter: after }));
  }
  await app.screenshot('synthetic-journal-return');
});

test('native direct dream link can return to the journal', async ({ app, screen, device }) => {
  await app.open();
  await device.openLink('noctalia://journal/1791266400000');
  await expect(screen.getByTestId('screen.dreamDetail')).toBeVisible();
  await expect(screen.getByText('Noctalia performance 013', { exact: true })).toBeVisible();
  await screen.getByTestId('btn.navigateJournal').tap();
  await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
  await expect(screen.getByTestId('screen.journal')).toBeVisible();
});

// The larger owned fixture keeps reference013 and appends older entries. This
// counterexample catches storage/list pagination that accidentally truncates
// full-text search to the first presentation window of forty dreams.
if (process.env.E2E_PERF_FIXTURE_COUNT === '5000') {
  test('native journal searches the complete stored history and preserves the query on return', async ({ app, screen, device }) => {
    await app.open();
    await device.openLink('noctalia://journal');
    await expect(screen.getByTestId('screen.journal')).toBeVisible();
    const search = screen.getByTestId('input.searchDreams');
    await screen.scrollUntilVisible(search, { direction: 'up' });
    await search.fill('Grand journal phrase repere 05000');
    const last = screen.getByRole('button', /^Noctalia charge 05000,/);
    await expect(last).toBeVisible();
    await expect(screen.getByRole('button', /^Noctalia performance 002,/)).toBeHidden();
    await last.tap();
    await expect(screen.getByText('Noctalia charge 05000', { exact: true })).toBeVisible();
    const end = screen.getByText(/Grand journal phrase repère 05000\./);
    await screen.scrollUntilVisible(end);
    await expect(end).toBeVisible();
    await app.screenshot('large-journal-last-entry');
    // This unanalysed entry is shorter. Bring the running head fully back below
    // system chrome before tapping it, even if its first visible part is clipped.
    const back = screen.getByTestId('btn.navigateJournal');
    await screen.scrollUntilVisible(back, { direction: 'up' });
    await screen.swipe({ direction: 'up', momentum: 'none' });
    await expect(back).toBeVisible();
    await back.tap();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
    await expect(last).toBeVisible();
    await search.fill('');
    // iOS's generic keyboard-dismiss gesture can activate the card beneath it.
    // Submit this single-line search field through its own keyboard return key.
    if (process.env.E2E_PERF_PLATFORM === 'ios') await search.press('Enter');
    else await device.dismissKeyboard();
    await expect(screen.getByTestId('screen.journal')).toBeVisible();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
    const second = screen.getByRole('button', /^Noctalia performance 002,/);
    // The keyboard and the first card can fill the viewport after clearing.
    await screen.scrollUntilVisible(second);
    await expect(second).toBeVisible();
    await expect(last).toBeHidden();
  });
}

// Four local, owned illustrations: valid thumbnail, missing thumbnail, both
// missing, and original-only. Distinct artwork lets the private screenshots prove
// which source decoded; cover presence alone does not prove image completion.
if (process.env.E2E_PERF_FIXTURE_MEDIA === 'local') {
  test('native journal illustrates thumbnails and recovers readable entries after image failures', async ({ app, screen, device }) => {
    await app.open();
    await device.openLink('noctalia://journal');
    await expect(screen.getByTestId('screen.journal')).toBeVisible();
    const search = screen.getByTestId('input.searchDreams');
    for (const index of [1, 2, 3, 4]) {
      await screen.scrollUntilVisible(search, { direction: 'up' });
      const title = `Noctalia performance ${String(index).padStart(3, '0')}`;
      if (process.env.E2E_PERF_PLATFORM === 'ios') {
        // The physical iOS driver's replacement fill can leave a suffix of the
        // previous value. Use the real clear affordance, then assert exact input.
        const clear = screen.getByTestId('component.searchBar').getByRole('button');
        if (await clear.isVisible()) await clear.tap();
        await expect(search).toHaveValue('');
      }
      await search.fill(title);
      await expect(search).toHaveValue(title);
      if (process.env.E2E_PERF_PLATFORM === 'ios') await search.press('Enter');
      else await device.dismissKeyboard();
      const entry = screen.getByRole('button', new RegExp(`^${title},`));
      await expect(entry).toBeVisible();
      const id = 1792303200000 - (index - 1) * 86400000;
      const cover = screen.getByTestId(`journal.cover.dream.item.${id}`);
      if (index === 3) await expect(cover).toBeHidden();
      else await screen.scrollUntilVisible(cover);
      await app.screenshot(`native-local-media-case-${index}`);
      await entry.tap();
      await expect(screen.getByTestId('screen.dreamDetail')).toBeVisible();
      await expect(screen.getByText(title, { exact: true })).toBeVisible();
      if (index !== 3) {
        const illustration = screen.getByTestId('btn.journal.illustration.expand');
        await screen.scrollUntilVisible(illustration);
        await illustration.tap();
        await expect(screen.getByTestId('modal.journal.illustration.fullscreen')).toBeVisible();
        await app.screenshot(`native-local-media-original-${index}`);
        await screen.getByTestId('btn.journal.illustration.close').tap();
      }
      await device.openLink('noctalia://journal');
      await expect(screen.getByTestId('screen.journal')).toBeVisible();
      await expect(screen.getByTestId('screen.dreamDetail')).toBeHidden();
    }
  });
}
