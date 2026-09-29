import { test, expect, type Page } from 'playwright/test';

async function startGuest(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('screen.onboarding')).toBeVisible();
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByTestId('btn.recording.home').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus') {
  await startGuest(page);
  await openSettings(page);
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function journal(page: Page) {
  const back = page.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else {
    await page.getByTestId('btn.recording.home').click();
    await page.getByRole('button', { name: 'Journal', exact: true }).click();
  }
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
}

async function search(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill(value);
}

async function openDream(page: Page, title: string) {
  await search(page, title);
  const card = page.getByTestId(/^dream\.item\./).filter({ hasText: title, visible: true });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
}

test('guest can start a first dream from onboarding', async ({ page }) => {
  await startGuest(page);
  await expect(page.getByTestId('btn.saveDream')).toBeDisabled();
});

test('guest keeps the same draft when switching capture modes', async ({ page }) => {
  await startGuest(page);
  const transcript = page.getByTestId('input.dreamTranscript');
  await transcript.fill('E2E draft: a lighthouse above the sea.');
  await page.getByTestId('btn.recording.inputMode.voice').click();
  await page.getByTestId('btn.recording.inputMode.text').click();
  await expect(transcript).toHaveValue('E2E draft: a lighthouse above the sea.');
});

test('guest saves the first dream and can read its simulated analysis', async ({ page }) => {
  await startGuest(page);
  const story = 'E2E moonlit harbor with a golden lighthouse.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByRole('button', { name: 'Close analysis', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Read the full analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Close analysis', exact: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
});

test('free user saves a dream and finds the exact story in the journal', async ({ page }) => {
  await selectProfile(page, 'existing');
  const story = 'E2E sapphire lighthouse above the quiet ocean.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByTestId('btn.editMetadata')).toBeEnabled();
  await page.getByTestId('btn.editMetadata').click();
  await page.getByTestId('input.dreamTitle').fill('E2E sapphire lighthouse');
  await page.getByTestId('btn.editMetadata').click();
  await journal(page);
  await openDream(page, 'E2E sapphire lighthouse');
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
});

test('free user searches, sees no match, and recovers the journal', async ({ page }) => {
  await selectProfile(page, 'existing');
  await journal(page);
  await search(page, 'The Infinite Library');
  await expect(page.getByTestId(/^dream\.item\./)).toHaveCount(1);
  await expect(page.getByTestId(/^dream\.item\./)).toContainText('The Infinite Library');
  await search(page, 'E2E no such dream 93f82');
  await expect(page.getByTestId(/^dream\.item\./)).toHaveCount(0);
  await search(page, 'The Infinite Library');
  await expect(page.getByTestId(/^dream\.item\./)).toHaveCount(1);
});

test('free user edits a story, cancels deletion, then deletes only that dream', async ({ page }) => {
  await selectProfile(page, 'existing');
  await journal(page);
  await openDream(page, 'The Infinite Library');
  await page.getByTestId('btn.editTranscript').click();
  await page.getByTestId('input.dreamTranscript').fill('E2E revised story: the library has a blue door.');
  await page.getByTestId('btn.editTranscript').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await page.getByTestId('btn.dream.delete').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await page.getByTestId('btn.dream.delete').click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
  await search(page, 'The Infinite Library');
  await expect(page.getByTestId(/^dream\.item\./)).toHaveCount(0);
  await search(page, 'Ocean of Stars');
  await expect(page.getByTestId(/^dream\.item\./)).toHaveCount(1);
});

test('free user can open the Plus offer and return without losing the journal', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openSettings(page);
  await page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true }).click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await page.getByTestId('btn.paywall.selectMonthly').click();
  await expect(page.getByTestId('btn.paywall.selectMonthly')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('screen.paywall')).toBeHidden();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await openDream(page, 'The Infinite Library');
});

for (const profile of ['existing', 'plus'] as const) {
  test(`${profile === 'plus' ? 'Plus' : 'free'} user sees the matching analysis allowance`, async ({ page }) => {
    await selectProfile(page, profile);
    await openSettings(page);
    if (profile === 'existing') {
      await expect(page.getByTestId('quota.analysisValue')).toContainText('/ 3');
      await page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true }).click();
      await expect(page.getByTestId('screen.paywall')).toBeVisible();
    } else {
      await expect(page.getByTestId('quota.analysisValue')).toContainText('Unlimited');
      await expect(page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true })).toHaveCount(0);
    }
  });
}

test('Plus user signs out and returns to guest without exposing the account journal', async ({ page }) => {
  await selectProfile(page, 'plus');
  await openSettings(page);
  await page.getByTestId('btn.auth.signOut').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await openSettings(page);
  await expect(page.getByTestId('settings-account-open-signin')).toBeVisible();
  await expect(page.getByTestId('btn.auth.signOut')).toHaveCount(0);
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByTestId('journal-first-page')).toBeVisible();
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
});

test('free user adds and removes a favorite through the filtered journal', async ({ page }) => {
  await selectProfile(page, 'existing');
  await journal(page);
  await openDream(page, 'Garden in the Clouds');
  await page.getByTestId('btn.dream.favorite').click();
  await journal(page);
  await page.getByRole('button', { name: 'Show favorites only', exact: true }).click();
  await openDream(page, 'Garden in the Clouds');
  await page.getByTestId('btn.dream.favorite').click();
  await journal(page);
  await page.getByRole('button', { name: 'Show favorites only', exact: true }).click();
  await search(page, 'Garden in the Clouds');
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all dreams', exact: true }).click();
  await openDream(page, 'Garden in the Clouds');
});

test('Plus user continues a reflection and sees the conversation on revisit', async ({ page }) => {
  await selectProfile(page, 'plus');
  await journal(page);
  await openDream(page, 'The Infinite Library');
  await page.getByTestId('component.dreamDetail.actionCard').click();
  await page.getByTestId('btn.dreamCategory.freeChat').click();
  await page.getByTestId('chat.input.message').fill('E2E: why did the library feel so familiar?');
  await page.getByTestId('chat.button.send').click();
  await expect(page.getByText('E2E: why did the library feel so familiar?', { exact: true })).toBeVisible();
  await expect(page.getByTestId('chat.input.message')).toBeEditable();
  const answer = page.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/);
  await expect(answer).toBeVisible();
  const response = await answer.innerText();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByTestId('btn.dreamCategory.freeChat').click();
  await expect(page.getByText('E2E: why did the library feel so familiar?', { exact: true })).toBeVisible();
  await expect(page.getByText(response, { exact: true })).toBeVisible();
});

test('exhausted free account can keep a dream and decline the analysis offer', async ({ page }) => {
  await selectProfile(page, 'existing');
  const story = 'E2E saved even when my analysis allowance is exhausted.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.getByTestId('btn.dream.primaryCta').click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByRole('button', { name: 'Read the full analysis', exact: true })).toHaveCount(0);
});

for (const profile of ['new', 'plus'] as const) {
  test(`${profile === 'new' ? 'fresh free' : 'Plus'} account can analyze a newly saved dream`, async ({ page }) => {
    await selectProfile(page, profile);
    const story = `E2E ${profile} traveler finds a lantern on a silver bridge.`;
    await page.getByTestId('input.dreamTranscript').fill(story);
    await page.getByTestId('btn.saveDream').click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
    await page.getByTestId('btn.dream.primaryCta').click();
    await expect(page.getByTestId('analysis.reading.close')).toBeVisible();
    await page.getByTestId('analysis.reading.close').click();
    await expect(page.getByRole('button', { name: 'Read the full analysis', exact: true })).toBeVisible();
    await expect(page.getByTestId('screen.paywall')).toHaveCount(0);
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  });
}
