import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

test('personal notes survive reload, edits and deletion without changing the dream; old dreams are rediscovered',
  { tags: ['personal-notes', 'persistence'], timeout: 180_000 }, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await app.open();
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      const unsubscribe = await browser.onDialog('accept');
      try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
      finally { await unsubscribe(); }
    }
    await screen.getByTestId('btn.onboarding.skip').tap();
    const story = 'E2E private reflection: a quiet blue bridge above the clouds.';
    const stop = await browser.onDialog('dismiss');
    try {
      await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
      await screen.getByTestId('btn.saveDream', { visible: true }).tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      const notes = screen.getByTestId('dream.personal-notes');
      await screen.getByTestId('dream.note.add').tap();
      await screen.getByTestId('dream.note.input').fill('Today this bridge reminds me of a fresh start.');
      await screen.getByTestId('dream.note.save').tap();
      await expect(notes).toContainText('Today this bridge reminds me of a fresh start.');
      await expect(screen.getByTestId('dream.note.input')).toHaveCount(0);
      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await screen.getByRole('button', /E2E private reflection/).tap();
      await expect(notes).toContainText('Today this bridge reminds me of a fresh start.');
      await notes.getByRole('button', 'Edit note').tap();
      await screen.getByTestId('dream.note.input').fill('A new perspective, while my original dream stays the same.');
      await screen.getByTestId('dream.note.save').tap();
      await expect(notes).toContainText('A new perspective, while my original dream stays the same.');
      await expect(notes).not.toContainText('Today this bridge reminds me of a fresh start.');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await app.screenshot('personal-note-edited');
      await notes.getByRole('button', 'Delete note').tap();
      await notes.getByRole('button', 'Cancel').tap();
      await expect(notes).toContainText('A new perspective, while my original dream stays the same.');
      await notes.getByRole('button', 'Delete note').tap();
      await notes.getByRole('button', 'Confirm deletion').tap();
      await expect(notes).not.toContainText('A new perspective, while my original dream stays the same.');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await screen.getByTestId('btn.navigateJournal', { visible: true }).tap();
      await screen.getByTestId('tab.home', { visible: true }).tap();
      await expect(screen.getByTestId('home.rediscovery')).toHaveCount(0);
      // Owned fixture: age the already-saved dream by 45 days, leaving its content unanalysed.
      await browser.evaluate((original: string) => {
        const key = 'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams';
        const dreams = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (dreams.length !== 1 || dreams[0].transcript !== original || dreams[0].personalNotes?.length !== 0) throw new Error('Missing persisted fixture');
        dreams[0].id = Date.now() - 45 * 86400000;
        localStorage.setItem(key, JSON.stringify(dreams));
        return true;
      }, story);
      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await screen.getByTestId('tab.home', { visible: true }).tap();
      await expect(screen.getByTestId('home.rediscovery')).toContainText(/Rediscover a dream/i);
      await screen.getByTestId('home.rediscovery').tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(notes.getByRole('button', 'Edit note')).toHaveCount(0);
    } finally { await stop(); }
  });

test('an over-limit pasted personal note stays intact until shortened, then survives saving and reload',
  { tags: ['personal-notes', 'persistence', 'note-length'], timeout: 180_000 }, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await app.open();
    await browser.emulateMedia({ reducedMotion: 'reduce' });
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      const unsubscribe = await browser.onDialog('accept');
      try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
      finally { await unsubscribe(); }
    }
    await screen.getByTestId('btn.onboarding.skip').tap();
    const story = 'E2E note length: I found a notebook beside a quiet river.';
    const valid = 'A reflection to keep. '.padEnd(4000, 'n');
    // The trailing space counts in the visible draft, even though save trims it.
    const overLimit = `${valid} `;
    const stop = await browser.onDialog('dismiss');
    try {
      await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
      await screen.getByTestId('btn.saveDream', { visible: true }).tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      const notes = screen.getByTestId('dream.personal-notes');
      const input = screen.getByTestId('dream.note.input');
      const save = screen.getByTestId('dream.note.save');
      const count = screen.getByTestId('dream.note.count');
      await screen.getByTestId('dream.note.add').tap();
      await input.tap();
      // Exercise an actual clipboard paste: fill() alone can bypass maxLength.
      await browser.evaluate(async (text: string) => { await navigator.clipboard.writeText(text); return true; }, overLimit);
      await input.press('ControlOrMeta+V');
      await expect(input).toHaveValue(overLimit);
      await expect(count).toHaveText('4001 / 4000');
      await expect(notes.getByRole('alert')).toContainText('4000');
      await expect(save).toBeDisabled();
      await app.screenshot('personal-note-over-limit-preserved');

      await input.press('End');
      await input.press('Backspace');
      await expect(input).toHaveValue(valid);
      await expect(count).toHaveText('4000 / 4000');
      await expect(screen.getByTestId('dream.note.length-error')).toHaveCount(0);
      await expect(save).toBeEnabled();
      await save.tap();
      await expect(input).toHaveCount(0);
      await expect(notes).toContainText(valid);
      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await screen.getByRole('button', /E2E note length/).tap();
      await expect(notes).toContainText(valid);
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);

      // An invalid edit can still be cancelled without replacing the saved note.
      await notes.getByRole('button', 'Edit note').tap();
      await expect(input).toHaveValue(valid);
      await input.fill(overLimit);
      await expect(input).toHaveValue(overLimit);
      await expect(save).toBeDisabled();
      await notes.getByRole('button', 'Cancel').tap();
      await expect(input).toHaveCount(0);
      await notes.getByRole('button', 'Edit note').tap();
      await expect(input).toHaveValue(valid);
      await expect(save).toBeEnabled();
      await notes.getByRole('button', 'Cancel').tap();
    } finally { await stop(); }
  });
