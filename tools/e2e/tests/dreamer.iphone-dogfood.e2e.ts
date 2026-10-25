import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

// Existing owner session, expired Plus / exhausted free allowance. No purchases,
// credential writes, account deletion, app installation or state reset.
test('iPhone caps exhausted quota and distinguishes deletion information', async ({ app, screen, device }) => {
  await app.open();
  if (process.env.E2E_IPHONE_CANDIDATE_URL) {
    await device.openLink(process.env.E2E_IPHONE_CANDIDATE_URL);
    // The dev client can expose the previous tree while Metro reloads the selected bundle.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await expect(screen.getByTestId('tab.home')).toBeVisible();
  }
  await device.openLink('noctalia://');
  await screen.getByTestId('tab.home').tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
  await screen.scrollUntilVisible(screen.getByTestId('quota.analysisValue'));
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText(/^Analyses offertes: 3 \/ 3$/);
  await screen.scrollUntilVisible(screen.getByTestId('settings-legal-account-deletion'));
  await expect(screen.getByTestId('settings-legal-account-deletion')).toContainText('Informations sur la suppression du compte');
  await expect(screen.getByTestId('settings-delete-account')).toContainText('Supprimer le compte');
  await app.screenshot('quota-and-distinct-legal-actions');
});

test('iPhone clears an empty search while the keyboard is open', async ({ app, screen, device }) => {
  await app.open();
  if (process.env.E2E_IPHONE_CANDIDATE_URL) {
    await device.openLink(process.env.E2E_IPHONE_CANDIDATE_URL);
    // The dev client can expose the previous tree while Metro reloads the selected bundle.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await expect(screen.getByTestId('tab.home')).toBeVisible();
  }
  await device.openLink('noctalia://journal');
  const search = screen.getByTestId('input.searchDreams');
  await search.fill('QA-NO-MATCH-IPHONE-DOGFOOD');
  const clear = screen.getByTestId('btn.empty.clearFilters');
  await expect(clear).toBeVisible();
  const keyboard = await device.locator('role=keyboard').boundingBox();
  const button = await clear.boundingBox();
  expect(keyboard).not.toBeNull();
  expect(button).not.toBeNull();
  expect(button!.y + button!.height).toBeLessThan(keyboard!.y);
  await app.screenshot('empty-search-clear-above-keyboard');
  await clear.tap();
  await expect(search).toHaveValue('');
  await expect(screen.getByTestId(/^dream.item\./).first()).toBeVisible();
});

test('iPhone uses singular symbol count and consistent French guide voice', async ({ app, screen, device }) => {
  await app.open();
  if (process.env.E2E_IPHONE_CANDIDATE_URL) {
    await device.openLink(process.env.E2E_IPHONE_CANDIDATE_URL);
    // The dev client can expose the previous tree while Metro reloads the selected bundle.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await expect(screen.getByTestId('tab.home')).toBeVisible();
  }
  await device.openLink('noctalia://symbol-dictionary');
  await screen.getByRole('textbox', 'Rechercher un symbole...').pressSequentially('elephant', { delay: 80 });
  await device.dismissKeyboard();
  await screen.getByRole('button', 'A-Z').tap();
  await expect(screen.getByText('1 symbole')).toBeVisible();
  await screen.getByRole('button', 'Éléphant', { exact: true }).tap();
  await expect(screen.getByText(/son attitude et ton ressenti guident la lecture/)).toBeVisible();
  await app.screenshot('elephant-summary-in-familiar-french');
  await device.openLink('noctalia://dream-guides');
  await expect(screen.getByText(/Comprends tes rêves, améliore ton rappel/)).toBeVisible();
  await device.openLink('noctalia://dream-guide/dream-journal');
  await screen.scrollUntilVisible(screen.getByTestId('dream-guide-point-0'));
  await expect(screen.getByTestId('dream-guide-point-0')).toContainText('Choisis le support');
  await app.screenshot('journal-guide-familiar-french');
});

test('iPhone keeps recall answers visible and readable after completion and relaunch', async ({ app, screen, device }) => {
  const marker = `QA-IPHONE-FIX-${Date.now()}`;
  const story = `${marker}. Je marche sur une plage bleue avec un cerf-volant jaune.`;
  const first = 'Coquillage violet.';
  const second = 'Une barque verte.';
  let created = false;
  let draftOwned = false;
  await app.open();
  if (process.env.E2E_IPHONE_CANDIDATE_URL) {
    await device.openLink(process.env.E2E_IPHONE_CANDIDATE_URL);
    // The dev client can expose the previous tree while Metro reloads the selected bundle.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await expect(screen.getByTestId('tab.home')).toBeVisible();
  }
  await device.openLink('noctalia://recording');
  const input = screen.getByTestId('input.dreamTranscript');
  // Refuse to overwrite a pre-existing personal draft.
  await expect(input).toHaveValue('');
  try {
    await input.fill('a');
    draftOwned = true;
    await screen.getByRole('button', 'Effacer le rêve', { exact: true }).tap();
    await expect(input).toHaveValue('');
    await input.fill(story);
    await screen.getByText('Capturer', { exact: true }).tap();
    await screen.getByTestId('btn.saveDream').tap();
    await expect(screen.getByTestId('screen.dreamDetail')).toBeVisible();
    created = true;
    await screen.scrollUntilVisible(screen.getByTestId('btn.dreamRecall.start'));
    await screen.getByTestId('btn.dreamRecall.start').tap();
    const answer = screen.getByTestId('input.dreamRecall.answer');
    for (const text of [first, second]) {
      await screen.scrollUntilVisible(answer);
      await expect.poll(async () => {
        const field = await answer.boundingBox();
        const dock = await screen.getByTestId('component.dreamDetail.actionDock').boundingBox();
        return field ? !dock || field.y + field.height <= dock.y : false;
      }).toBe(true);
      await answer.tap();
      await expect(device.locator('role=keyboard')).toBeVisible();
      await expect(screen.getByTestId('component.dreamDetail.actionDock')).toBeHidden();
      await expect.poll(async () => {
        const field = await answer.boundingBox();
        const keyboard = await device.locator('role=keyboard').boundingBox();
        return field && keyboard ? field.y >= 0 && field.y + field.height <= keyboard.y : false;
      }).toBe(true);
      // Native clear-and-fill can miss a moved input; type into the empty next field.
      await expect(answer).toHaveValue('');
      await answer.pressSequentially(text, { delay: 20 });
      await expect(answer).toHaveValue(text);
      await expect.poll(async () => {
        const field = await answer.boundingBox();
        const keyboard = await device.locator('role=keyboard').boundingBox();
        return field && keyboard ? field.y >= 0 && field.y + field.height <= keyboard.y : false;
      }).toBe(true);
      await app.screenshot(text === first ? 'recall-first-answer-visible' : 'recall-second-answer-visible');
      await device.dismissKeyboard();
      await screen.scrollUntilVisible(screen.getByTestId('btn.dreamRecall.submit'));
      await screen.getByTestId('btn.dreamRecall.submit').tap();
      await expect(screen.getByText(text, { exact: true })).toBeVisible();
    }
    await screen.swipe({ from: { x: 420, y: 600 }, to: { x: 420, y: 200 }, duration: 400 });
    await screen.getByTestId('btn.dreamRecall.complete').tap();
    await expect(screen.getByText('C’est assez pour l’instant', { exact: true })).toBeVisible();
    await expect(answer).toBeHidden();
    await device.openLink('noctalia://journal');
    await screen.getByTestId('input.searchDreams').fill(marker);
    await screen.getByTestId('input.searchDreams').press('Enter');
    await expect(screen.getByTestId(/^dream.item\./)).toHaveCount(1);
    await screen.getByTestId(/^dream.item\./).tap();
    await screen.scrollUntilVisible(screen.getByTestId('dreamRecall.savedDetails'));
    await expect(screen.getByText(first, { exact: true })).toBeVisible();
    await expect(screen.getByText(second, { exact: true })).toBeVisible();
    await device.closeApp();
    await app.open();
    if (process.env.E2E_IPHONE_CANDIDATE_URL) {
      await device.openLink(process.env.E2E_IPHONE_CANDIDATE_URL);
      // The previous tree can remain visible during this development-client reload.
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await expect(screen.getByTestId('tab.home')).toBeVisible();
    }
    await device.openLink('noctalia://journal');
    await screen.getByTestId('input.searchDreams').fill(marker);
    await screen.getByTestId('input.searchDreams').press('Enter');
    await screen.getByTestId(/^dream.item\./).tap();
    await screen.scrollUntilVisible(screen.getByTestId('dreamRecall.savedDetails'));
    await expect(screen.getByText(first, { exact: true })).toBeVisible();
    await expect(screen.getByText(second, { exact: true })).toBeVisible();
    await app.screenshot('recall-details-after-relaunch');
  } finally {
    if (!created && draftOwned) {
      await device.openLink('noctalia://recording');
      const remaining = await input.inputValue();
      if (remaining === 'a' || remaining?.startsWith(marker)) {
        await screen.getByRole('button', 'Effacer le rêve', { exact: true }).tap();
        await expect(input).toHaveValue('');
      }
    }
    if (created) {
      await device.openLink('noctalia://journal');
      await screen.getByTestId('input.searchDreams').fill(marker);
      await screen.getByTestId('input.searchDreams').press('Enter');
      await expect(screen.getByTestId(/^dream.item\./)).toHaveCount(1);
      await screen.getByTestId(/^dream.item\./).tap();
      // Check ownership before deleting only this invocation's synthetic dream.
      await expect(screen.getByText(story, { exact: true }).first()).toBeVisible();
      // Swipe the outer right margin: the multiline input owns its own scroller.
      await screen.swipe({ from: { x: 420, y: 600 }, to: { x: 420, y: 200 }, duration: 400 });
      await screen.swipe({ from: { x: 420, y: 600 }, to: { x: 420, y: 200 }, duration: 400 });
      await screen.getByTestId('btn.dream.delete').tap();
      await screen.getByRole('button', 'Supprimer', { exact: true }).tap();
      await expect(screen.getByTestId('screen.journal')).toBeVisible();
      await screen.getByTestId('input.searchDreams').fill(marker);
      await screen.getByTestId('input.searchDreams').press('Enter');
      await expect(screen.getByTestId(/^dream.item\./)).toHaveCount(0);
      await screen.getByTestId('btn.empty.clearFilters').tap();
      await device.openLink('noctalia://');
    }
  }
});
