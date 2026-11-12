import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid, waitForLucidReady } from '../lucid-web-fixtures';

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
