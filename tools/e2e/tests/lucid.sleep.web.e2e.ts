import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid, waitForLucidReady } from '../lucid-web-fixtures';
import type { LucidTrainerState } from '@/lib/lucid/model';

type Fixtures = Parameters<typeof completeOnboarding>[0];

const guestStateKey = 'noctalia_lucid_trainer:guest:state_v1';
const sleepTest = { tags: ['lucid-sleep-first'] };
const testNight = '2026-11-07T23:30:00+01:00';

async function guestState(browser: Browser): Promise<LucidTrainerState> {
  const raw = await browser.evaluate(key => localStorage.getItem(key), guestStateKey);
  if (!raw) throw new Error('Lucid guest onboarding has not persisted');
  return JSON.parse(raw);
}

async function writeGuestState(browser: Browser, state: LucidTrainerState) {
  await browser.evaluate(([key, raw]) => {
    localStorage.setItem(key, raw);
    return null;
  }, [guestStateKey, JSON.stringify(state)]);
}

async function openSleepFixture(f: Fixtures, date = testNight) {
  // Keep browser timers moving. A session-local override lets the calendar case
  // revisit the same program several dates later without changing its state.
  await f.browser.addInitScript(({ start, origin }) => {
    if (location.origin !== origin) return;
    const realNow = Date.now.bind(Date);
    const key = 'lucid-fixture-clock-offset';
    const saved = sessionStorage.getItem(key);
    const offset = saved === null ? start - realNow() : Number(saved);
    sessionStorage.setItem(key, String(offset));
    Date.now = () => realNow() + offset;
  }, { start: Date.parse(date), origin: new URL(f.app.baseUrl!).origin });
  await completeOnboarding(f);
  const state = await guestState(f.browser);
  state.onboarding.audioSafetyAccepted = true;
  await writeGuestState(f.browser, state);
  return state;
}

for (const debt of [false, true]) {
  test(`Lucid sleep first: ${debt ? 'sleep debt' : 'control'} with zero attempts from morning to weekly review`, sleepTest, async f => {
    const { app, screen, browser } = f;
    await openSleepFixture(f);
    await openLucid(app, browser, '/lucid/morning');
    await screen.getByTestId('lucid-morning-nothing').tap();
    await screen.getByRole('radio', /Non entendue/, { visible: true }).tap();
    await screen.getByTestId('lucid-morning-next').tap();
    await screen.getByTestId('lucid-morning-details').tap();
    const note = 'Je me sens anormalement fatigué.';
    await screen.getByRole('textbox', 'Quelques détails neutres').fill(note);
    if (debt) await screen.getByRole('checkbox', 'Dette de sommeil').tap();
    await screen.getByTestId('lucid-morning-details-done').tap();
    await screen.getByTestId('lucid-morning-save').tap();
    await expect.poll(async () => (await guestState(browser)).experiments.length).toBe(1);
    expect((await guestState(browser)).experiments[0]).toMatchObject({
      notes: note, factors: debt ? ['sleep_debt'] : [], technique: null, result: null,
    });
    await openLucid(app, browser, '/lucid');
    const primary = screen.getByTestId('lucid-today-primary', { visible: true });
    await expect(primary).toContainText(debt ? 'Revoir la nuit passée' : 'Préparer cette nuit');
    await primary.tap();
    await expect(screen.getByTestId(debt ? 'lucid-morning' : 'lucid-night', { visible: true })).toBeVisible();
    await expect.poll(() => browser.evaluate(() => location.pathname)).toBe(debt ? '/lucid/morning' : '/lucid/night');

    await openLucid(app, browser, '/lucid/weekly');
    expect((await guestState(browser)).experiments[0].occurredAt)
      .toBeLessThanOrEqual(await browser.evaluate(() => Date.now()));
    const weekly = screen.getByTestId('lucid-weekly', { visible: true });
    await expect(screen.getByTestId('lucid-weekly-next')).toBeEnabled();
    const advice = await weekly.textContent();
    await app.screenshot(debt ? 'debt-weekly-focus' : 'control-weekly-focus');
    await screen.getByTestId('lucid-weekly-next').tap();
    await expect(screen.getByRole('textbox', 'Qu’est-ce qui a aidé ou perturbé le sommeil ?')).toBeVisible();
    expect(await browser.evaluate(() => location.pathname)).toBe('/lucid/weekly');
    expect((await guestState(browser)).progress).toEqual([]);
    expect(advice).toContain(debt ? 'protéger le sommeil en priorité' : 'MILD');

    await openLucid(app, browser, '/lucid/progress');
    const progress = screen.getByTestId('lucid-progress', { visible: true });
    await expect(progress.getByText('Adaptation hors ligne', { exact: true })).toBeVisible();
    const restAdvice = progress.getByText(/Privilégiez le repos cette nuit/, { visible: true });
    if (debt) await expect(restAdvice).toBeVisible({ timeout: 3000 });
    else await expect(restAdvice).toHaveCount(0);
  });
}

test('Lucid sleep first: missed practice dates preserve the next session and its place', sleepTest, async f => {
  const { app, screen, browser } = f;
  const state = await openSleepFixture(f, '2026-11-03T23:30:00+01:00');
  const startedAt = Date.parse('2026-11-02T20:00:00+01:00');
  state.progress = [{
    technique: 'mild', programId: 'mild-foundations', status: 'paused', currentDay: 2,
    completedExerciseIds: ['mild-01'], practiceDates: ['2026-11-02'],
    startedAt, completedAt: null, updatedAt: startedAt,
  }];
  await writeGuestState(browser, state);
  await openLucid(app, browser, '/lucid/program/mild');
  const next = screen.getByTestId('lucid-journey-session-2');
  const following = screen.getByTestId('lucid-journey-session-3');
  const resume = screen.getByTestId('lucid-journey-continue', { visible: true });
  await expect(resume).toContainText('Reprendre l’entraînement');
  const dates = [await next.getAttribute('aria-label'), await following.getAttribute('aria-label')];
  expect(dates[0]).toMatch(/mer.*4/);
  expect(dates[1]).toMatch(/ven.*6/);
  await browser.evaluate(time => {
    sessionStorage.setItem('lucid-fixture-clock-offset', String(time - new Date().getTime()));
    return null;
  }, Date.parse(testNight));
  await browser.reload();
  await waitForLucidReady(browser);
  await expect(resume).toBeEnabled();
  expect([await next.getAttribute('aria-label'), await following.getAttribute('aria-label')]).toEqual(dates);
  await expect(screen.getByTestId('lucid-journey-safety')).toContainText('Les jours manqués restent disponibles');
  expect((await guestState(browser)).progress).toEqual(state.progress);
  await resume.tap();
  await expect(screen.getByTestId('lucid-guided-intro')).toBeVisible();
  await expect.poll(() => browser.evaluate(() => location.pathname)).toBe('/lucid/session/mild/2');
  expect((await guestState(browser)).progress[0]).toMatchObject({
    status: 'active', currentDay: 2, completedExerciseIds: ['mild-01'], practiceDates: ['2026-11-02'],
  });
});

test('Lucid sleep first: method evidence and weekly trend distinguish zero, two and three attempts', sleepTest, async f => {
  const { app, screen, browser } = f;
  const state = await openSleepFixture(f);
  const evidence: string[] = [];
  const expandedHasEarlySignal: boolean[] = [];
  for (const count of [0, 2, 3]) {
    state.experiments = Array.from({ length: count }, (_, index) => {
      const time = Date.parse(testNight) - (index + 1) * 86_400_000;
      return { id: `fixture-mild-${index}`, occurredAt: time, updatedAt: time, technique: 'mild',
        preparationMinutes: 5, result: 'lucid', lucidityLevel: 3, recallLevel: 3, sleepQuality: 4, factors: [] };
    });
    await writeGuestState(browser, state);
    await openLucid(app, browser, '/lucid/progress');
    const toggle = screen.getByTestId('lucid-progress-methods-toggle');
    await expect(toggle).toBeVisible();
    await expect(screen.getByTestId('lucid-progress-method-mild')).toContainText(count ? `${count} essais` : 'Aucun essai');
    await expect(screen.getByText('Plus d’observations nécessaires', { exact: true }).first()).toBeVisible();
    evidence.push((await toggle.textContent()) ?? '');
    await toggle.tap();
    expandedHasEarlySignal.push(await screen.getByText('Signal précoce', { exact: true, visible: true }).count() > 0);
    await app.screenshot(`method-evidence-${count}`);
    if (count > 0) {
      await screen.getByRole('button', 'Faire le bilan hebdomadaire').tap();
      const weekly = screen.getByTestId('lucid-weekly', { visible: true });
      await expect(weekly).toContainText('Prochain axe suggéré');
      await expect(weekly.getByText('MILD', { exact: true })).toHaveCount(count === 3 ? 1 : 0);
    }
  }
  expect(evidence[2]).toContain('Signal précoce');
  expect(expandedHasEarlySignal).toEqual([false, false, true]);
  for (const insufficient of evidence.slice(0, 2)) {
    expect(insufficient).not.toContain('Signal précoce');
    expect(insufficient).toMatch(/insuffisant|nécessaire|assez|trop peu/i);
  }
});
