import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

const KEY = 'noctalia.aiConsent.v2';

// Withdrawing the AI permission in Settings takes effect in the same session: the next AI
// action asks again and a refusal sends nothing. Turning it back on shows the same
// disclosure first, and once accepted the action runs without another prompt.
// The desktop sidebar moves between Capture, the dream and Settings without a reload.
test('withdrawing AI in settings asks again before the next reading and turning it back on lets it run', { tags: ['consent', 'settings'] }, async ({ app, browser, screen }) => {
  await isolateWeb(browser, app);
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  // A user who accepted earlier, as the web fixtures grant it.
  await browser.evaluate(`localStorage.setItem('${KEY}', 'granted')`);

  const story = 'E2E consent settings: a copper owl above a sleeping town.';
  const browserDialogs: string[] = [];
  const stop = await browser.onDialog(async dialog => {
    browserDialogs.push(dialog.message);
    await dialog.dismiss();
  });
  try {
    const consent = screen.getByTestId('modal.aiConsent', { visible: true });
    const row = screen.getByTestId('settings-ai-consent', { visible: true });
    const toggle = screen.getByTestId('btn.settings.aiConsent', { visible: true });
    const stored = () => browser.evaluate<string | null>(`localStorage.getItem('${KEY}')`);

    await screen.getByTestId('tab.settings', { visible: true }).tap();
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
    await row.scrollIntoView();
    await expect(row).toHaveAttribute('aria-checked', 'true');
    await expect(row).toContainText('AI to explore and illustrate my dreams');
    await expect(row).toContainText('On');
    await app.screenshot('ai-setting-on');

    await toggle.tap();
    await expect(row).toHaveAttribute('aria-checked', 'false');
    await expect(row).toContainText('Off');
    await expect.poll(stored).toBeNull();
    await expect(consent).toBeHidden();
    await app.screenshot('ai-setting-off');

    await screen.getByTestId('tab.addDream', { visible: true }).tap();
    await screen.getByTestId('input.dreamTranscript').fill(story);
    await screen.getByTestId('btn.saveDream').tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(consent).toBeHidden();
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    expect(await stored()).toBeNull();

    // Turning it on shows the disclosure first; declining there leaves it off.
    await screen.getByTestId('tab.settings', { visible: true }).tap();
    await row.scrollIntoView();
    await expect(row).toHaveAttribute('aria-checked', 'false');
    await toggle.tap();
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(consent).toBeHidden();
    await expect(row).toHaveAttribute('aria-checked', 'false');
    expect(await stored()).toBeNull();

    await toggle.tap();
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.accept', { visible: true }).tap();
    await expect(consent).toBeHidden();
    await expect(row).toHaveAttribute('aria-checked', 'true');
    await expect.poll(stored).toBe('granted');

    // The sidebar opens Settings as a tab, without history back to the dream: the journal leads there.
    await screen.getByTestId('tab.journal', { visible: true }).tap();
    const card = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(card).toHaveCount(1);
    await card.tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await screen.getByTestId('btn.dream.primaryCta').tap();
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await expect(consent).toBeHidden();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    expect(browserDialogs).toEqual([]);
    await app.screenshot('ai-reading-after-consent-restored');
  } finally { stop(); }
});
