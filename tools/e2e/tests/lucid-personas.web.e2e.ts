import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding } from '../lucid-web-fixtures';

test('Lucid beginner discovers SSILD and pauses the practice', { agent: 'beginner', tags: ['personas', 'persona-beginner'] }, async fixtures => {
  await completeOnboarding(fixtures);
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
  await expect(screen.getByText(/^En pause\./, { visible: true })).toBeVisible();
  await app.screenshot('persona-lucid-beginner-pause');
});

test('Lucid journal reader retrieves a saved morning capture', { agent: 'journal', tags: ['personas', 'persona-journal'] }, async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, agent } = fixtures;
  const note = 'Un jardin calme et une porte lumineuse, fixture locale.';
  await app.open('/lucid/morning');
  await screen.getByTestId('lucid-morning-write', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-recall-text', { visible: true }).fill(note);
  await screen.getByTestId('lucid-morning-next', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-cue-not_heard', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-next', { visible: true }).tap();
  await screen.getByTestId('lucid-morning-save', { visible: true }).tap();
  await app.open('/lucid/journal');
  await expect(screen.getByRole('button', `Ouvrir le rêve : ${note}`, { visible: true })).toBeVisible();
  await app.restart();
  await app.open('/lucid');
  await agent.act('Ouvrir le journal des rêves.');
  await expect(screen.getByTestId('lucid-journal', { visible: true })).toBeVisible();
  await agent.act('Ouvrir le rêve qui contient {fragment}.', { params: { fragment: 'une porte lumineuse' } });
  await expect.poll(() => fixtures.browser.url()).toMatch(/\/lucid\/observation\?id=/);
  await expect(screen.getByTestId('lucid-journal', { visible: true })).toHaveCount(0);
  await expect(screen.getByText(note, { exact: true, visible: true }).last()).toBeVisible();
  await app.screenshot('persona-lucid-retrieved-capture');
});
