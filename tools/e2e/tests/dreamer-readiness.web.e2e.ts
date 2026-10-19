import { createParityTest, expect } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });

test('ready reading becomes readable without waiting for the symbol constellation', async ({ page }, info) => {
  await page.addInitScript(() => {
    const timings: Record<string, number> = {};
    Object.assign(window, { readinessTimings: timings });
    const watch = () => {
      const acknowledged = performance.getEntriesByName('noctalia.journal.save_acknowledged')[0];
      if (acknowledged) timings.saveAcknowledged ??= acknowledged.startTime;
      const action = document.querySelector<HTMLElement>('[data-testid="btn.dream.primaryCta"]');
      if (action && !document.querySelector('[data-testid="component.recording.dreamSeal"]')) {
        const box = action.getBoundingClientRect();
        let opacity = 1;
        for (let node: HTMLElement | null = action; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (opacity >= .95 && box.top >= 0 && box.bottom <= innerHeight && hit && action.contains(hit)) timings.savedActionReadable ??= performance.now();
      }
      const text = document.querySelector<HTMLElement>('[data-testid="component.dreamDetail.interpretation"]');
      if (text?.textContent?.trim()) {
        timings.textCommitted ??= performance.now();
        let opacity = 1;
        for (let node: HTMLElement | null = text; node; node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        if (opacity >= .95) timings.textOpacityReady ??= performance.now();
        const box = text.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(16, box.height / 2));
        if (opacity >= 0.95 && box.top >= 0 && box.top + 24 < innerHeight && hit && text.contains(hit)) timings.textReadable ??= performance.now();
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('input.dreamTranscript').fill('Readiness QA: Je regarde une porte dans la forêt, puis une lumière près du lac.');
  await page.getByTestId('btn.saveDream').click();
  // The baseline waits for the capture ceremony. The optimized arrival exposes
  // an explicit read-later action immediately after durable save.
  await page.getByTestId(process.env.E2E_PERF_BASELINE === '1' ? 'btn.dreamCaptureSeal.readLater' : 'btn.dreamCaptureSeal.openDream').click();
  await expect(page.getByTestId('screen.dreamDetail')).toBeVisible();
  await page.getByTestId('btn.dream.primaryCta').click();
  const reading = page.getByTestId('component.dreamDetail.interpretation');
  await expect(reading).toContainText(/\S[\s\S]{30}/);
  // The application brings the interpretation into view. The test never scrolls it there.
  const baseline = process.env.E2E_PERF_BASELINE === '1';
  await expect.poll(() => page.evaluate((field) => (window as unknown as { readinessTimings: Record<string, number> }).readinessTimings[field] ?? 0,
    baseline ? 'textOpacityReady' : 'textReadable')).toBeGreaterThan(0);
  const timings = await page.evaluate(() => (window as unknown as { readinessTimings: Record<string, number> }).readinessTimings);
  const gapMs = timings.textReadable === undefined ? null : timings.textReadable - timings.textCommitted;
  await info.attach('readiness-timings', { contentType: 'application/json', body: JSON.stringify({ ...timings, committedToReadableMs: gapMs,
    committedToOpacityReadyMs: timings.textOpacityReady - timings.textCommitted,
    saveAcknowledgedToActionReadableMs: timings.savedActionReadable - timings.saveAcknowledged,
    environment: 'web mock, normal motion, opacity >= .95, first line on screen, DOM hit test, no test scroll' }) });
  if (!baseline) { expect(gapMs).not.toBeNull(); expect(gapMs!).toBeLessThan(500); }
  await page.screenshot({ path: info.outputPath('reading-readable.png') });
  await expect(page.getByTestId('btn.editDream')).toBeEnabled();
});
