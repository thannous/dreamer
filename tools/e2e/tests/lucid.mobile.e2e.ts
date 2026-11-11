import { openNativeLink } from '../native-links';
import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { activateLucid, captureWrittenDream } from '../lucid-native-fixtures';

for (const lab of ['stabilization', 'ssild']) {
  test(`Lucid release resumes a paused ${lab} practice after process restart`, { tags: ['recovery', 'practice'] }, async fixtures => {
    const { app, screen } = fixtures;
    await activateLucid(fixtures);
    const link = `noctalia-lucid:///lucid/${lab}-lab`;
    await openNativeLink(fixtures, link);
    const start = screen.getByTestId(`lucid-${lab}-lab-primary`, { visible: true });
    const pause = screen.getByTestId(`lucid-${lab}-lab-pause`, { visible: true });
    await start.tap();
    await expect(pause).toBeEnabled();
    await pause.tap();
    await expect(screen.getByText(/^(En pause\.|Paused\.)/, { visible: true }).first()).toBeVisible();
    await app.restart();
    await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
    await openNativeLink(fixtures, link);
    await expect(screen.getByText(/^(En pause\.|Paused\.)/, { visible: true }).first()).toBeVisible();
    await start.tap();
    await expect(pause).toBeEnabled();
    await expect(screen.getByText(/^(En pause\.|Paused\.)/, { visible: true })).toHaveCount(0);
    await app.screenshot(`${lab}-native-recovery`);
  });
}

test('Lucid release counts a completed practice once across two restarts', { tags: ['practice', 'persistence'] }, async fixtures => {
  const { app, screen } = fixtures;
  await activateLucid(fixtures);
  await openNativeLink(fixtures, 'noctalia-lucid:///lucid/stabilization-lab');
  const primary = screen.getByTestId('lucid-stabilization-lab-primary', { visible: true });
  await primary.tap();
  await screen.getByTestId('lucid-stabilization-lab-repeat', { visible: true }).tap();
  for (let step = 1; step <= 5; step++) {
    // UIKit exposes the progressbar as "other"; assert its visible step text.
    await expect(screen.getByText(new RegExp(`^(Étape|Step) ${step} (sur|of) 5$`), { visible: true }).first()).toBeVisible();
    await primary.tap();
  }
  await expect(primary).toContainText(/Terminer le laboratoire|Finish the lab/);
  await primary.tap();
  await expect(screen.getByTestId('lucid-stabilization-lab-live', { visible: true })).toContainText(/Pratique terminée|Practice complete/i);
  for (let restart = 0; restart < 2; restart++) {
    await app.restart();
    await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
    await openNativeLink(fixtures, 'noctalia-lucid:///lucid/progress');
    const metricLabels = {
      practices: /^(Pratiques|Practices): 1$/,
      completions: /^(Complétions|Completions): 1$/,
      repeats: /^(Répétitions|Repeats): 1$/,
    };
    for (const [metric, label] of Object.entries(metricLabels)) {
      const count = screen.getByTestId(`lucid-progress-stabilization-${metric}`, { visible: true });
      await screen.scrollUntilVisible(count);
      await expect(count).toHaveAccessibleName(label);
    }
  }
  await app.screenshot('lucid-native-completion-once');
});

test('Lucid release refuses a beginner wake-back-to-bed session even through a deep link', { tags: ['safeguards'] }, async fixtures => {
  await activateLucid(fixtures);
  await openNativeLink(fixtures, 'noctalia-lucid:///lucid/session/wbtb/1');
  await expect(fixtures.screen.getByText(/^(Séance indisponible|Session unavailable)$/, { visible: true }).first()).toBeVisible();
  await fixtures.app.restart();
  await expect(fixtures.screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
  await fixtures.app.screenshot('lucid-native-sleep-safeguard');
});

test('Lucid release requires both intention and experience', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall').tap();
  await screen.scrollUntilVisible(screen.getByTestId('lucid-experience-beginner', { visible: true }));
  await screen.getByTestId('lucid-experience-beginner').tap();
  await expect(screen.getByTestId('lucid-onboarding-continue')).toBeEnabled();
  await screen.getByTestId('lucid-onboarding-continue', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-sleep-wake-time', { visible: true })).toBeVisible();
  await app.screenshot('release-onboarding-gate');
});

test('Lucid release completes its local plan, persists activation and opens the main tabs', async fixtures => {
  const { app, screen } = fixtures;
  await activateLucid(fixtures);
  await app.restart();
  await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
  for (const tab of ['journal', 'programs', 'progress', 'today']) {
    await screen.getByTestId(`lucid-tab-${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`lucid-${tab}`, { visible: true })).toBeVisible();
  }
  // Night opens from Today's « Préparer cette nuit » shortcut, right under the main
  // action and clear of the floating tabs without scrolling.
  const night = screen.getByTestId('lucid-tab-night', { visible: true });
  await night.tap();
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  await app.screenshot('release-lucid-activated-tabs');
});

test('Lucid release keeps a written morning capture after restart and lists it in Journal', { tags: ['persistence'] }, async fixtures => {
  const { app, screen } = fixtures;
  const note = 'Fixture Lucid : un jardin calme et une porte lumineuse.';
  await activateLucid(fixtures);
  await captureWrittenDream(fixtures, note);
  await app.restart();
  await screen.getByTestId('lucid-tab-journal', { visible: true }).tap();
  // Android's emulator runs Lucid in English, the iOS Simulator in French.
  const dream = new RegExp(`^(Ouvrir le rêve : |Open dream: )${note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  await expect(screen.getByRole('button', dream, { visible: true })).toBeVisible();
  await app.screenshot('release-lucid-capture-persisted');
});

test('Lucid release deletes all its local data and starts again at onboarding', { tags: ['persistence'] }, async fixtures => {
  const { app, screen, platform } = fixtures;
  await activateLucid(fixtures);
  await captureWrittenDream(fixtures, 'Fixture Lucid : une donnée à effacer.');
  await screen.getByTestId('lucid-tab-journal', { visible: true }).tap();
  await screen.getByRole('button', /^(Ouvrir le profil|Open profile)$/, { visible: true }).tap();
  // Data management is a link inside the collapsed « Ressources et contrôle » section.
  const resources = screen.getByTestId('lucid-settings-resources', { visible: true });
  await screen.scrollUntilVisible(resources);
  await resources.tap();
  const dataLabel = /Gestion des données|Data management/;
  // iOS exposes the row as a link; Android as a group around its text.
  const dataRow = platform === 'ios'
    ? screen.getByRole('link', dataLabel, { visible: true })
    : screen.getByText(dataLabel, { visible: true });
  await screen.scrollUntilVisible(dataRow);
  // Both platforms report a partially visible row whose centre is under the floating tabs.
  await screen.swipe({ direction: 'down' });
  await dataRow.tap();
  const deleteLabel = /^(Supprimer les données Lucid|Delete Lucid data)$/i;
  const remove = screen.getByRole('button', deleteLabel, { visible: true });
  await screen.scrollUntilVisible(remove);
  await screen.swipe({ direction: 'down' });
  await remove.tap();
  // The confirmation repeats the label: the alert's button is the last match.
  await expect(screen.getByText(/^(Supprimer toutes les données Lucid \?|Delete all Lucid data\?)$/, { visible: true })).toBeVisible();
  await screen.getByRole('button', deleteLabel, { visible: true }).last().tap();
  await expect(screen.getByText(/^(Données Lucid supprimées|Lucid data deleted)$/, { visible: true })).toBeVisible();
  await screen.getByRole('button', /^(Terminé|Done)$/i, { visible: true }).tap();
  await expect(screen.getByTestId('lucid-onboarding-continue', { visible: true })).toBeDisabled();
  await app.restart();
  await expect(screen.getByTestId('lucid-onboarding-continue', { visible: true })).toBeDisabled();
  await expect(screen.getByTestId('lucid-today')).toHaveCount(0);
  await app.screenshot('release-lucid-data-deleted');
});

// Native bar pixels cannot be qualified by the browser. Capture the art overlay,
// scrolled page and a different tab after the overlay's focus entry is released.
test('Lucid release keeps system bars legible over art and restores them after navigation', { tags: ['system-bars'] }, async fixtures => {
  const { app, screen } = fixtures;
  await activateLucid(fixtures);
  await app.screenshot('lucid-system-bars-art');
  await screen.getByTestId('lucid-tab-settings', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-settings', { visible: true })).toBeVisible();
  for (const mode of ['light', 'dark'] as const) {
    const option = screen.getByTestId(`lucid-theme-${mode}`, { visible: true });
    await screen.scrollUntilVisible(option);
    await option.tap();
    await expect(option).toBeChecked();
    await app.screenshot(`lucid-system-bars-settings-${mode}`);
    await screen.getByTestId('lucid-tab-today', { visible: true }).tap();
    await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
    await app.screenshot(`lucid-system-bars-today-${mode}`);
    await screen.getByTestId('lucid-tab-settings', { visible: true }).tap();
    await expect(screen.getByTestId('lucid-settings', { visible: true })).toBeVisible();
  }
});
