import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { activateLucid, captureWrittenDream } from '../lucid-native-fixtures';

test('Lucid beginner discovers SSILD and pauses the practice', { agent: 'beginner', tags: ['personas', 'persona-beginner'], timeout: 300_000 }, async fixtures => {
  await activateLucid(fixtures);
  const { agent, app, screen } = fixtures;
  await agent.act("Ouvrir les programmes d’entraînement.");
  await expect(screen.getByTestId('lucid-programs', { visible: true })).toBeVisible();
  await agent.act('Faire apparaître entièrement le bouton « Ouvrir le laboratoire sensoriel SSILD » (en anglais « Open SSILD sensory lab ») dans cette liste, en faisant défiler, sans encore l’ouvrir.');
  await expect(screen.getByTestId('lucid-programs-ssild-lab', { visible: true })).toBeVisible();
  await agent.act('Ouvrir ce laboratoire sensoriel SSILD. La destination affiche le titre « Laboratoire sensoriel SSILD » ou « SSILD sensory lab » et un bouton pour commencer la pratique.');
  await expect(screen.getByTestId('lucid-ssild-lab-primary', { visible: true })).toBeVisible();
  await agent.act('Démarrer la pratique SSILD.');
  await expect(screen.getByTestId('lucid-ssild-lab-pause', { visible: true })).toBeEnabled();
  await agent.act('Mettre cette pratique en pause.');
  await expect(screen.getByText(/^(En pause\.|Paused\.)/, { visible: true }).first()).toBeVisible();
  await app.screenshot('persona-lucid-beginner-pause');
});

test('Lucid journal reader retrieves a saved morning capture', { agent: 'journal', tags: ['personas', 'persona-journal'], timeout: 300_000 }, async fixtures => {
  await activateLucid(fixtures);
  const { app, screen, agent } = fixtures;
  const note = 'Un jardin calme et une porte lumineuse, fixture locale.';
  await captureWrittenDream(fixtures, note);
  await app.restart();
  await agent.act('Ouvrir le journal des rêves.');
  await expect(screen.getByTestId('lucid-journal', { visible: true })).toBeVisible();
  await agent.act('Ouvrir le rêve qui contient {fragment}.', { params: { fragment: 'une porte lumineuse' } });
  await expect(screen.getByTestId('lucid-journal', { visible: true })).toHaveCount(0);
  await expect(screen.getByRole('button', /^(Retour|Back)$/, { visible: true })).toBeVisible();
  await expect(screen.getByText(note, { exact: true, visible: true }).last()).toBeVisible();
  await app.screenshot('persona-lucid-retrieved-capture');
});
