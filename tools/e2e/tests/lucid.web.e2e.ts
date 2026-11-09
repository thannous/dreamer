import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid, waitForLucidReady } from '../lucid-web-fixtures';
import { isolateWeb } from '../web-fixtures';
import type { LucidTrainerState } from '@/lib/lucid/model';

type Fixtures = Parameters<typeof completeOnboarding>[0];

test('Lucid requires intention and experience before opening sleep settings', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await openLucid(app, browser);
  const next = screen.getByRole('button', 'Continuer', { exact: true });
  await expect(next).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  await expect(next).toBeEnabled();
  await next.tap();
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-sleep-wake-time', { visible: true })).toBeVisible();
  await app.screenshot('sleep-settings');
});

// Night and Settings are tabs without a button. Expo Router 58 sent every visit
// to them back to Today, so the profile button, the Night shortcut and the
// Night link did nothing.
test('Lucid opens Night and Settings from Today and from a link', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  await openLucid(app, browser, '/lucid?ambience=dark');
  // Night and Settings take no slot either: the four visible tabs share the bar.
  await expect(screen.getByRole('tab', /.*/, { visible: true })).toHaveCount(4);
  const share = await browser.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    // Each tab sits in its slot; the slots share one row.
    const row = tabs[0].parentElement!.parentElement!.getBoundingClientRect().width;
    return tabs.reduce((sum, tab) => sum + tab.getBoundingClientRect().width, 0) / row;
  });
  expect(share).toBeGreaterThan(0.95);
  await screen.getByTestId('lucid-tab-settings', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-settings', { visible: true })).toBeVisible();
  await expect(screen.getByRole('tab', /.*/, { visible: true })).toHaveCount(4);
  await openLucid(app, browser, '/lucid?ambience=dark');
  await screen.getByTestId('lucid-tab-night', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  await openLucid(app, browser, '/lucid/night?ambience=dark');
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  expect(await browser.evaluate(() => location.pathname)).toBe('/lucid/night');
  await app.screenshot('lucid-night-from-link');
});

test('Lucid recovers a blocked ambience with a playable retry and no unhandled rejection', async fixtures => {
  const { app, screen, browser } = fixtures;
  await completeOnboarding(fixtures);
  await browser.addInitScript(() => {
    const observed = window as Window & { __lucidAudioErrors?: string[] };
    const errors: string[] = [];
    observed.__lucidAudioErrors = errors;
    // Observe browser errors without cancelling or filtering the app's error events.
    window.addEventListener('error', event => errors.push(event.message));
    window.addEventListener('unhandledrejection', event => {
      errors.push(String(event.reason));
    });
  });
  let audioRequests = 0;
  let retry = false;
  let releaseRetry!: () => void;
  const retryResponse = new Promise<void>(resolve => { releaseRetry = resolve; });
  await browser.route('https://noctalia.app/audio/sleep/rain-v2.m4a', async route => {
    audioRequests += 1;
    if (!retry) {
      // Keep the existing cross-origin network refusal for the initial load.
      await route.abort();
      return;
    }
    // Hold the local response until the UI proves that it is preparing the retry.
    await retryResponse;
    await route.fulfill({
      path: '../../assets/lucid/audio/lucid_cue_rain_very_low.wav',
      contentType: 'audio/wav',
    });
  });
  try {
    await openLucid(app, browser, '/lucid/night?ambience=dark');
    await screen.getByTestId('lucid-night-signals-toggle', { visible: true }).tap();
    const play = screen.getByTestId('lucid-night-ambience-play', { visible: true });
    const failure = screen.getByTestId('lucid-night-ambience-error', { visible: true });
    // This is the player's real load deadline, not an arbitrary test sleep.
    await expect(failure).toContainText('Ce son n’a pas pu être téléchargé', { timeout: 35_000 });
    await expect(play).toContainText('Réessayer');
    await expect(play).toBeEnabled();
    expect(audioRequests).toBeGreaterThan(0);
    const errors = () => browser.evaluate(() =>
      (window as Window & { __lucidAudioErrors?: string[] }).__lucidAudioErrors ?? ['Error observer missing']);
    // The positive fallback above gives the failed request time to report its rejection.
    expect(await errors()).toEqual([]);
    await app.screenshot('lucid-ambience-blocked-fallback');
    const requestsBeforeRetry = audioRequests;
    retry = true;
    await play.tap();
    await expect(play).toBeDisabled();
    await expect(failure).toBeHidden();
    await expect.poll(() => audioRequests).toBeGreaterThan(requestsBeforeRetry);
    releaseRetry();
    // A retry must actually start the sound; clearing the error alone misses a lost play request.
    await expect(play).toContainText('Mettre l’ambiance en pause');
    await expect(play).toBeEnabled();
    await app.screenshot('lucid-ambience-retry-playing');
    await screen.getByTestId('lucid-night-ambience-stop', { visible: true }).tap();
    await expect(play).toContainText('Lancer l’ambiance');
    expect(await errors()).toEqual([]);
  } finally {
    releaseRetry();
  }
});

test('PR237 Lucid dark time fields stay readable and the schedule survives reload', async fixtures => {
  await completeOnboarding(fixtures, true);
  const { app, screen, browser } = fixtures;
  await openLucid(app, browser, '/lucid/settings?ambience=dark');
  await browser.reload();
  await waitForLucidReady(browser);
  await expect(screen.getByTestId('lucid-bedtime-input', { visible: true })).toHaveValue('21:45');
  await expect(screen.getByTestId('lucid-wake-input', { visible: true })).toHaveValue('06:15');
  await app.screenshot('persisted-sleep-schedule');
});

test('PR237 Lucid compact tabs, program safeguards and account validation remain usable', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  for (const width of [320, 360, 390]) {
    await browser.setViewport({ width, height: 844 });
    await openLucid(app, browser, '/lucid?ambience=dark');
    await expect(screen.getByRole('tab', /.*/, { visible: true })).toHaveCount(4);
    const geometry = await browser.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(tab => {
        const label = Array.from(tab.querySelectorAll('*')).find(node => node.textContent === tab.getAttribute('aria-label'));
        if (!label) return false;
        const rect = label.getBoundingClientRect();
        return rect.height >= Number.parseFloat(getComputedStyle(label).lineHeight) && label.scrollWidth <= rect.width + 1;
      });
      const shortcuts = Array.from(document.querySelectorAll('[data-testid="lucid-today-shortcuts"] *'))
        .filter(node => node.children.length === 0 && node.textContent?.trim() && getComputedStyle(node).fontFamily.includes('Outfit'));
      // Night has no tab: its shortcut must be reachable on a first look, above the floating bar.
      const row = document.querySelector('[data-testid="lucid-today-shortcuts"]')!.getBoundingClientRect();
      const bar = document.querySelector('[role="tablist"]')!.getBoundingClientRect();
      return { tabs, shortcutsClearOfBar: row.bottom <= bar.top, shortcuts: shortcuts.map(node => {
        const rect = node.getBoundingClientRect();
        return node.scrollHeight <= rect.height + 1 && node.scrollWidth <= rect.width + 1;
      }) };
    });
    expect(geometry.tabs).toEqual([true, true, true, true]);
    expect(geometry.shortcutsClearOfBar).toBe(true);
    expect(geometry.shortcuts.length).toBeGreaterThan(0);
    expect(geometry.shortcuts.every(Boolean)).toBe(true);
    await app.screenshot(`complete-tab-labels-${width}`);
  }
  await browser.setViewport({ width: 390, height: 844 });
  for (const program of ['mild', 'ssild', 'wbtb']) for (const theme of ['dark', 'light']) {
    await openLucid(app, browser, `/lucid/program/${program}?ambience=${theme}`);
    await expect(screen.getByText('Méthode et sécurité', { visible: true })).toBeVisible();
    await app.screenshot(`${program}-${theme}`);
  }
  await openLucid(app, browser, '/lucid/session/wbtb/1');
  await expect(screen.getByText('Séance indisponible', { visible: true })).toBeVisible();
  await openLucid(app, browser, '/lucid/account?ambience=light');
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await expect(screen.getByTestId('settings-account-sheet', { visible: true })).toBeVisible();
  const surface = await browser.evaluate(() => {
    const sheet = document.querySelector('[data-testid="settings-account-sheet"]')!;
    const surface = Array.from(sheet.querySelectorAll('*')).find(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)' && node.getBoundingClientRect().width > sheet.getBoundingClientRect().width * 0.8 && node.getBoundingClientRect().height > 200);
    return getComputedStyle(surface ?? sheet).backgroundColor;
  });
  // The shared Noctalia paper surface replaces pure white. Keep this opaque:
  // a transparent sheet would let the underlying page interfere with the form.
  expect(surface).toBe('rgb(245, 234, 219)');
  await screen.getByTestId('input.auth.email', { visible: true }).fill('invalid-email');
  await expect(screen.getByTestId('btn.auth.signIn', { visible: true })).toBeDisabled();
  await app.screenshot('lucid-invalid-account-form');
  await screen.getByRole('button', 'Terminé', { visible: true }).tap();
});

test('PR237 Lucid morning captures persist in Journal and confirmed signs reach Atlas', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  const notes = ['Fixture Lucid : un jardin calme et une porte lumineuse.', 'Fixture Lucid : je traverse le jardin et je remarque la porte lumineuse.'];
  for (const note of notes) {
    await openLucid(app, browser, '/lucid/morning?ambience=light');
    await screen.getByRole('radio', /Écrire Notez/, { visible: true }).tap();
    await screen.getByRole('textbox', 'Écrivez ce qui reste', { visible: true }).fill(note);
    await screen.getByRole('button', 'Continuer', { visible: true }).tap();
    await screen.getByRole('radio', /Non entendue/, { visible: true }).tap();
    await screen.getByRole('button', 'Continuer', { visible: true }).tap();
    await screen.getByRole('button', 'Enregistrer la capture', { visible: true }).tap();
    await expect.poll(() => browser.evaluate(value => Object.values(localStorage).some(item => item.includes(value)), note)).toBe(true);
  }
  await openLucid(app, browser, '/lucid/journal?ambience=light');
  for (const note of notes) await expect(screen.getByRole('button', `Ouvrir le rêve : ${note}`, { visible: true })).toBeVisible();
  await app.screenshot('journal-saved-captures');
  await openLucid(app, browser, '/lucid/dream-signs?ambience=light');
  await screen.getByTestId('lucid-dream-sign-sign:lucid:jardin', { visible: true })
    .getByRole('button', 'Confirmer le signe').tap();
  await openLucid(app, browser, '/lucid/dream-atlas?ambience=light');
  const node = screen.getByTestId('lucid-dream-atlas-node-sign:lucid:jardin', { visible: true });
  await expect(node).toContainText('Vu dans 2 rêves');
  await node.tap();
  const detail = screen.getByTestId('lucid-dream-atlas-detail-sign:lucid:jardin', { visible: true });
  await expect(detail).toContainText(/Rêves sources/i);
  await expect(detail.getByRole('link')).toHaveCount(2);
  for (const note of notes) await expect(detail).toContainText(note);
  await app.screenshot('atlas-confirmed-sign');
});

test('PR237 Lucid exercises retain their pause after reload and resume; unsold Plus and Health links land home', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  for (const lab of ['stabilization', 'ssild']) {
    await openLucid(app, browser, `/lucid/${lab}-lab?ambience=dark`);
    const primary = screen.getByTestId(`lucid-${lab}-lab-primary`, { visible: true });
    const pause = screen.getByTestId(`lucid-${lab}-lab-pause`, { visible: true });
    await primary.tap();
    await expect(screen.getByRole('progressbar', lab === 'ssild' ? /^Sens 1 sur/ : /^Étape 1 sur/, { visible: true })).toBeVisible();
    await pause.tap();
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeVisible();
    await browser.reload();
    await waitForLucidReady(browser);
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeVisible();
    await primary.tap();
    await expect(pause).toBeEnabled();
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeHidden();
    await app.screenshot(`${lab}-resumed-after-reload`);
  }
  for (const route of ['morning-voice', 'permissions']) {
    await openLucid(app, browser, `/lucid/${route}?ambience=dark`);
    for (const text of ['Ne jamais inventer', 'avant release', 'Échantillons utilisables'])
      await expect(screen.getByText(text, { exact: false, visible: true })).toBeHidden();
    await app.screenshot(route);
  }
  // v1 sells no Plan and ships no Apple Health import: direct links land on Lucid home.
  for (const [route, testId] of [['subscription', 'lucid-subscription-screen'], ['sleep-integration', 'lucid-sleep-connect']]) {
    await openLucid(app, browser, `/lucid/${route}?ambience=dark`);
    await expect(screen.getByRole('tab', 'Journal', { visible: true })).toBeVisible();
    await expect.poll(() => browser.evaluate(() => location.pathname)).not.toContain(route);
    await expect(screen.getByTestId(testId, { visible: true })).toBeHidden();
    await app.screenshot(`${route}-redirected-home`);
  }
});

test('Lucid completes a stabilization practice once and preserves its progress after restart', { tags: ['practice', 'persistence'] }, async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  const revealMetrics = async () => {
    await browser.evaluate(() => {
      const card = document.querySelector('[data-testid="lucid-progress-stabilization"]');
      if (!card) throw new Error('The stabilization progress card is missing');
      card.scrollIntoView({ block: 'center' });
      return null;
    });
    await expect.poll(() => browser.evaluate(() => {
      const card = document.querySelector('[data-testid="lucid-progress-stabilization"]');
      const box = card?.getBoundingClientRect();
      return !!box && box.top >= 0 && box.bottom <= innerHeight;
    })).toBe(true);
  };
  await openLucid(app, browser, '/lucid/stabilization-lab?ambience=dark');
  const primary = screen.getByTestId('lucid-stabilization-lab-primary', { visible: true });
  await primary.tap();
  await screen.getByTestId('lucid-stabilization-lab-repeat', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-stabilization-lab-step')).toContainText('1 répétition');
  for (let step = 1; step <= 5; step++) {
    await expect(screen.getByRole('progressbar', `Étape ${step} sur 5`, { visible: true })).toBeVisible();
    await primary.tap();
  }
  await expect(primary).toContainText('Terminer le laboratoire');
  await primary.tap();
  await expect(screen.getByTestId('lucid-stabilization-lab-live')).toContainText('Pratique terminée');
  await app.restart();
  await openLucid(app, browser, '/lucid/progress?ambience=dark');
  await revealMetrics();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices')).toHaveAccessibleName('Pratiques: 1');
  await expect(screen.getByTestId('lucid-progress-stabilization-completions')).toHaveAccessibleName('Complétions: 1');
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  // A second restart must not record another completion.
  await app.restart();
  await openLucid(app, browser, '/lucid/progress?ambience=dark');
  await revealMetrics();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  await app.screenshot('completed-practice-survives-two-restarts');
});

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
