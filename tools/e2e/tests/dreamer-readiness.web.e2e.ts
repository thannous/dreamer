import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });

test('ready reading becomes readable without waiting for the symbol constellation', async ({ page }, info) => {
  await page.addInitScript(() => {
    const timings: Record<string, number> = {};
    Object.assign(window, { readinessTimings: timings });
    const watch = () => {
      const acknowledged = performance.getEntriesByName('noctalia.journal.save_acknowledged')[0];
      if (acknowledged) timings.saveAcknowledged ??= acknowledged.startTime;
      for (const [name, selector] of Object.entries({
        transcript: '[data-testid="component.transcriptCard"]',
        dock: '[data-testid="component.dreamDetail.actionDock"] [role="button"], [data-testid="component.dreamDetail.actionDock"] button',
      })) {
        const content = document.querySelector<HTMLElement>(selector);
        if (!content) continue;
        timings[`${name}Committed`] ??= performance.now();
        let opacity = 1;
        for (let node: HTMLElement | null = content; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        if (opacity >= .95) timings[`${name}OpacityReady`] ??= performance.now();
      }
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
  if (process.env.E2E_PERF_BASELINE !== '1') {
    // Data carried through the capture handoff must not replay a second entrance.
    await expect.poll(() => page.evaluate(() => {
      const timings = (window as unknown as { readinessTimings: Record<string, number> }).readinessTimings;
      return ['transcript', 'dock'].every(name => timings[`${name}OpacityReady`] !== undefined);
    })).toBe(true);
    const arrival = await page.evaluate(() => (window as unknown as { readinessTimings: Record<string, number> }).readinessTimings);
    expect(arrival.transcriptOpacityReady - arrival.transcriptCommitted).toBeLessThan(100);
    expect(arrival.dockOpacityReady - arrival.dockCommitted).toBeLessThan(100);
  }
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
  if (!baseline) {
    expect(gapMs).not.toBeNull();
    expect(timings.textOpacityReady - timings.textCommitted).toBeLessThan(100);
    expect(gapMs!).toBeLessThan(1000);
  }
  await page.screenshot({ path: info.outputPath('reading-readable.png') });
  await expect(page.getByTestId('btn.editDream')).toBeEnabled();
});

async function savePlusDream(page: Page, story: string) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await expect(page.getByTestId('btn.dreamCaptureSeal.openDream')).toHaveCount(0);
  await page.getByTestId('btn.saveDream').click();
}

test('capture shortcut preserves the reading already chosen and creates one journal entry', async ({ page }, info) => {
  await savePlusDream(page, 'Shortcut choice QA: I see a doorway by a quiet lake.');
  await page.getByTestId('btn.dreamCaptureSeal.readNow').click();
  await page.getByTestId('btn.dreamCaptureSeal.openDream').dblclick();
  await expect(page.getByTestId('screen.dreamDetail')).toBeVisible();
  // No second analyze press: the choice made in the ceremony must survive the shortcut.
  await expect(page.getByTestId('component.dreamDetail.interpretation')).toContainText(/\S[\s\S]{30}/);
  await page.getByTestId('btn.navigateJournal').scrollIntoViewIfNeeded();
  await page.getByTestId('btn.navigateJournal').click();
  await expect(page.getByRole('button', { name: /^Shortcut choice QA:/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Shortcut choice QA:/ }).click();
  await page.getByTestId('btn.editDream').scrollIntoViewIfNeeded();
  await page.getByTestId('btn.editDream').click();
  await expect(page.getByTestId('input.dreamTranscript')).toHaveValue('Shortcut choice QA: I see a doorway by a quiet lake.');
  // Mock saveDreams intentionally uses session memory. Restart durability belongs
  // to the real SQLite/native journey, never to a browser-mock reload assertion.
  await page.screenshot({ path: info.outputPath('shortcut-one-journal-dream.png') });
});

const reduced = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
reduced('reduced motion opens the saved page without waiting for optional naming', async ({ page }, info) => {
  const story = 'Reduced arrival QA: the first words remain the name during this visit.';
  await savePlusDream(page, story);
  await expect(page.getByTestId('component.recording.dreamSeal')).toHaveCount(0);
  await expect(page.getByTestId('screen.dreamDetail')).toBeVisible();
  const read = page.getByTestId('btn.dream.primaryCta');
  await expect(read).toBeVisible();
  await expect(read).toBeEnabled();
  await page.getByTestId('btn.editDream').click();
  await expect(page.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await page.getByTestId('btn.saveDreamEdit').click();
  await page.screenshot({ path: info.outputPath('reduced-saved-access.png') });
});
