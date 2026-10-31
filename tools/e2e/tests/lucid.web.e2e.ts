import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

test('Lucid requires intention and experience before opening sleep settings', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
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

type Fixtures = { app: App; screen: Screen; browser: Browser };

async function frenchGuest({ app, browser }: Fixtures) {
  await isolateWeb(browser, app);
  await app.open('/lucid/onboarding?ambience=light');
}

async function completeOnboarding(fixtures: Fixtures, checkContrast = false) {
  const { app, screen, browser } = fixtures;
  await frenchGuest(fixtures);
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  const next = screen.getByTestId('lucid-onboarding-continue', { visible: true });
  await next.tap();
  await app.open('/lucid/onboarding?ambience=dark');
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  for (const [id, value] of [['lucid-sleep-bedtime', '21:45'], ['lucid-sleep-wake-time', '06:15']]) {
    const control = screen.getByTestId(id, { visible: true });
    await control.tap();
    const input = browser.locator('input[type="time"]');
    await expect(input).toBeVisible();
    if (checkContrast) {
      const result = await browser.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('input[type="time"]')!;
        const style = getComputedStyle(input);
        let parent = input.parentElement;
        while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3)
          .map(v => Number(v) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(style.color), b = luminance(getComputedStyle(parent!).backgroundColor);
        return { scheme: style.colorScheme, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      expect(result.scheme).toBe('dark');
      expect(result.contrast).toBeGreaterThanOrEqual(4.5);
      await app.screenshot(`${id}-readable-dark`);
    }
    await input.fill(value);
    await screen.getByRole('button', 'Terminé', { visible: true }).tap();
    await expect(control).toContainText(value);
  }
  await screen.getByTestId('lucid-wake-sensitivity-not_sensitive', { visible: true }).tap();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-plan', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-local-first', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByRole('tab', 'Journal', { visible: true })).toBeVisible();
}

// Night and Settings are tabs without a button. Expo Router 58 sent every visit
// to them back to Today, so the profile button, the Night shortcut and the
// Night link did nothing.
test('Lucid opens Night and Settings from Today and from a link', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  await app.open('/lucid?ambience=dark');
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
  await app.open('/lucid?ambience=dark');
  await screen.getByTestId('lucid-tab-night', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  await app.open('/lucid/night?ambience=dark');
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
    await app.open('/lucid/night?ambience=dark');
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
  await app.open('/lucid/settings?ambience=dark');
  await browser.reload();
  await expect(screen.getByTestId('lucid-bedtime-input', { visible: true })).toHaveValue('21:45');
  await expect(screen.getByTestId('lucid-wake-input', { visible: true })).toHaveValue('06:15');
  await app.screenshot('persisted-sleep-schedule');
});

test('PR237 Lucid compact tabs, program safeguards and account validation remain usable', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  for (const width of [320, 360, 390]) {
    await browser.setViewport({ width, height: 844 });
    await app.open('/lucid?ambience=dark');
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
    await app.open(`/lucid/program/${program}?ambience=${theme}`);
    await expect(screen.getByText('Méthode et sécurité', { visible: true })).toBeVisible();
    await app.screenshot(`${program}-${theme}`);
  }
  await app.open('/lucid/session/wbtb/1');
  await expect(screen.getByText('Séance indisponible', { visible: true })).toBeVisible();
  await app.open('/lucid/account?ambience=light');
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await expect(screen.getByTestId('settings-account-sheet', { visible: true })).toBeVisible();
  const surface = await browser.evaluate(() => {
    const sheet = document.querySelector('[data-testid="settings-account-sheet"]')!;
    const surface = Array.from(sheet.querySelectorAll('*')).find(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)' && node.getBoundingClientRect().width > sheet.getBoundingClientRect().width * 0.8 && node.getBoundingClientRect().height > 200);
    return getComputedStyle(surface ?? sheet).backgroundColor;
  });
  expect(surface).toBe('rgb(255, 255, 255)');
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
    await app.open('/lucid/morning?ambience=light');
    await screen.getByRole('radio', /Écrire Notez/, { visible: true }).tap();
    await screen.getByRole('textbox', 'Écrivez ce qui reste', { visible: true }).fill(note);
    await screen.getByRole('button', 'Continuer', { visible: true }).tap();
    await screen.getByRole('radio', /Non entendue/, { visible: true }).tap();
    await screen.getByRole('button', 'Continuer', { visible: true }).tap();
    await screen.getByRole('button', 'Enregistrer la capture', { visible: true }).tap();
    await expect.poll(() => browser.evaluate(value => Object.values(localStorage).some(item => item.includes(value)), note)).toBe(true);
  }
  await app.open('/lucid/journal?ambience=light');
  for (const note of notes) await expect(screen.getByRole('button', `Ouvrir le rêve : ${note}`, { visible: true })).toBeVisible();
  await app.screenshot('journal-saved-captures');
  await app.open('/lucid/dream-signs?ambience=light');
  await screen.getByTestId('lucid-dream-sign-sign:lucid:jardin', { visible: true })
    .getByRole('button', 'Confirmer le signe').tap();
  await app.open('/lucid/dream-atlas?ambience=light');
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
    await app.open(`/lucid/${lab}-lab?ambience=dark`);
    const primary = screen.getByTestId(`lucid-${lab}-lab-primary`, { visible: true });
    const pause = screen.getByTestId(`lucid-${lab}-lab-pause`, { visible: true });
    await primary.tap();
    await expect(screen.getByRole('progressbar', lab === 'ssild' ? /^Sens 1 sur/ : /^Étape 1 sur/, { visible: true })).toBeVisible();
    await pause.tap();
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeVisible();
    await browser.reload();
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeVisible();
    await primary.tap();
    await expect(pause).toBeEnabled();
    await expect(screen.getByText(/^En pause\./, { visible: true })).toBeHidden();
    await app.screenshot(`${lab}-resumed-after-reload`);
  }
  for (const route of ['morning-voice', 'permissions']) {
    await app.open(`/lucid/${route}?ambience=dark`);
    for (const text of ['Ne jamais inventer', 'avant release', 'Échantillons utilisables'])
      await expect(screen.getByText(text, { exact: false, visible: true })).toBeHidden();
    await app.screenshot(route);
  }
  // v1 sells no Plan and ships no Apple Health import: direct links land on Lucid home.
  for (const [route, testId] of [['subscription', 'lucid-subscription-screen'], ['sleep-integration', 'lucid-sleep-connect']]) {
    await app.open(`/lucid/${route}?ambience=dark`);
    await expect(screen.getByRole('tab', 'Journal', { visible: true })).toBeVisible();
    await expect.poll(() => browser.evaluate(() => location.pathname)).not.toContain(route);
    await expect(screen.getByTestId(testId, { visible: true })).toBeHidden();
    await app.screenshot(`${route}-redirected-home`);
  }
});

test('Lucid completes a stabilization practice once and preserves its progress after restart', { tags: ['practice', 'persistence'] }, async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen } = fixtures;
  await app.open('/lucid/stabilization-lab?ambience=dark');
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
  await app.open('/lucid/progress?ambience=dark');
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  // A second restart must not record another completion.
  await app.restart();
  await app.open('/lucid/progress?ambience=dark');
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  await app.screenshot('completed-practice-survives-two-restarts');
});
