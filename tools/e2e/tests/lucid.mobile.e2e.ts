import { test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';

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

type Fixtures = TestFixtures & { device: Device };

async function activateLucid({ app, screen, platform }: Fixtures) {
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
async function captureWrittenDream({ screen, device, platform }: Fixtures, note: string) {
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

test('Lucid release completes its local plan, persists activation and opens the main tabs', async fixtures => {
  const { app, screen, platform } = fixtures;
  await activateLucid(fixtures);
  await app.restart();
  await expect(screen.getByTestId('lucid-today', { visible: true })).toBeVisible();
  for (const tab of ['journal', 'programs', 'progress', 'today']) {
    await screen.getByTestId(`lucid-tab-${tab}`, { visible: true }).tap();
    await expect(screen.getByTestId(`lucid-${tab}`, { visible: true })).toBeVisible();
  }
  // Night opens from Today's « Préparer cette nuit » button, whose centre sits
  // under the iPhone's floating tabs until the screen scrolls a little.
  const night = screen.getByTestId('lucid-tab-night', { visible: true });
  await screen.scrollUntilVisible(night);
  if (platform === 'ios') await screen.swipe({ direction: 'down' });
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
