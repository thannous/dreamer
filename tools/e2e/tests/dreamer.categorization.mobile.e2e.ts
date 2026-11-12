import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { tapWhenStill } from '../native-settle';
import { openApp } from '../test-support/open-app';
import { submitIosSearch, settingsScrollUp, leaveGuidedStories, acceptAiConsent, tapClearOfActionDock, dismissCaptureKeyboard } from '../dreamer-native-fixtures';

// The persistent mock profile seeds this entry. Explicit expectations keep
// Node collection independent of the app's React Native/media imports.
const SEEDED_OTHER_DREAM = {
  title: 'The Infinite Library',
  transcript: 'I found myself in an enormous library with endless shelves reaching up into darkness. Books were floating around me, their pages turning on their own. I picked up a golden book that seemed to glow, and when I opened it, I could see memories from my childhood playing out on the pages like a movie.',
};

for (const editor of ['metadata', 'transcript'] as const) {
  test(`Dreamer release background categorization preserves the ${editor} draft and isolates another entry`, {
    // The 30 s categorization, two edits and two searches take 91-161 s on the iOS Simulator:
    // its switch back to the full keyboard after a fill once held the field for 23 s.
    tags: ['journal-concurrency'], timeout: 180_000,
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' || Number(process.env.E2E_NATIVE_MOCK_CATEGORIZATION_MS) < 20000
      ? 'Requires an identified persistent mock Release with the bounded categorization QA opt-in.' : false,
  }, async ({ app, screen, device, platform }) => {
    await openApp(app);
    await app.clearState();
    await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
    // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
    await leaveGuidedStories(screen);
    await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
    const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
    await screen.scrollUntilVisible(settings, { direction: 'up' });
    await settings.tap();
    const all = screen.getByTestId('quick-settings.all', { visible: true });
    await screen.scrollUntilVisible(all); await all.tap();
    // Categorization after a save never asks: it runs only once AI is allowed, here in Settings.
    // On iOS the whole permission row is the switch, as VoiceOver activates it: its inner
    // Switch is no longer an element of its own there.
    const ai = screen.getByTestId(platform === 'ios' ? 'settings-ai-consent' : 'btn.settings.aiConsent', { visible: true });
    await screen.scrollUntilVisible(ai);
    // One tap only: a second one turns AI off again. iOS asks in a sheet, Android allows at once.
    await tapWhenStill(ai);
    await acceptAiConsent(screen, platform);
    await expect(ai).toBeChecked();
    const signin = screen.getByTestId('settings-account-open-signin', { visible: true });
    await settingsScrollUp({ screen, platform }, signin);
    // The page still glides after the drags that brought the row in.
    await tapWhenStill(signin);
    await screen.getByTestId('btn.mockProfile.existing', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
    const story = 'E2E sapphire lighthouse above the quiet ocean.';
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await dismissCaptureKeyboard({ screen, device, platform });
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    // The real loading indicator witnesses that the response is still pending.
    // No device clock/evaluation API, fixed sleep or injected UI control is used.
    const pending = screen.getByTestId('text.dreamMetadata.pending');
    await expect(pending).toBeVisible();
    await expect(pending).toHaveCount(1);
    // One edit control opens the name and the story together; the sheet saves them.
    const button = screen.getByTestId('btn.editDream', { visible: true });
    await tapClearOfActionDock(screen, button);
    const input = screen.getByTestId(editor === 'metadata' ? 'input.dreamTitle' : 'input.dreamTranscript');
    const draft = editor === 'metadata' ? 'E2E personal lighthouse title' : 'E2E revised story: the lighthouse has a blue door. I climb three quiet staircases, count the windows, and see a yellow boat passing the harbour. The lamp turns slowly above me while I write down every detail before waking.';
    // The sheet is still rising after the edit tap, and a tap then can miss the field: its
    // text stays and the typing goes nowhere. Focus the field first, as a person would.
    await input.tap(); await expect(input).toBeFocused();
    await input.fill(draft);
    await expect(input).toBeVisible();
    await app.screenshot(`release-${editor}-keyboard-focus`);
    if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(input).toHaveValue(draft);
    await expect(pending).toBeVisible();
    // Absence from the complete tree, not just offscreen, witnesses the real
    // categorization update while this same editor remains open.
    await expect(pending).toHaveCount(0);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(draft);
    await app.screenshot(`release-${editor}-draft-after-categorization`);
    const save = screen.getByTestId('btn.saveDreamEdit', { visible: true });
    await screen.scrollUntilVisible(save); await save.tap();
    await expect(input).toHaveCount(0);
    const back = screen.getByTestId('btn.navigateJournal', { visible: true });
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    const title = editor === 'metadata' ? draft : 'E2E sapphire lighthouse above the quiet ocean';
    await search.fill(title);
    if (platform === 'ios') await submitIosSearch(screen);
    else await device.dismissKeyboard();
    await expect(search).toHaveValue(title);
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
    await expect(card).toHaveCount(1);
    // The results are still settling after Search, and a tap then can miss the card: the page
    // itself, not the card's own title, proves it opened.
    const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
    await tapWhenStill(card);
    await expect(detail).toBeVisible();
    // The new name shows as the page title and in the page's header.
    if (editor === 'metadata') await expect(screen.getByText(draft, { visible: true }).first()).toBeVisible();
    else {
      if (platform === 'ios') {
        // One active detail and one story card: no AX echo of another scene answers for it.
        await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toHaveCount(1);
        await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toHaveCount(1);
      }
      // iOS and Android expose the drop cap's inline object after the initial, so the exact
      // story text matches nothing: read the prose by its ID, past its first letter.
      const transcript = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
      await screen.scrollUntilVisible(transcript); await expect(transcript).toContainText(draft.slice(1));
    }
    await tapClearOfActionDock(screen, button);
    await input.tap(); await expect(input).toBeFocused();
    if (platform === 'ios' && editor === 'transcript') {
      // A fill once kept a suffix of the long multiline story: empty it first and check.
      // UIKit's menu is no way there: on a French simulator a tap on an English word opens
      // the spelling suggestions, not Select All.
      await input.clear();
      await expect(input).toHaveValue('');
    }
    await input.fill('E2E abandoned local draft');
    if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(input).toHaveValue('E2E abandoned local draft');
    // The editor's veil covers the page's Back: the draft is left by the sheet's own Cancel.
    const cancel = screen.getByTestId('btn.cancelDreamEdit', { visible: true });
    await screen.scrollUntilVisible(cancel); await cancel.tap();
    await expect(input).toHaveCount(0);
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await search.fill('The Infinite Library');
    if (platform === 'ios') await submitIosSearch(screen);
    else await device.dismissKeyboard();
    await expect(search).toHaveValue('The Infinite Library');
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const other = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' });
    await expect(other).toHaveCount(1);
    await tapWhenStill(other);
    await expect(detail).toBeVisible();
    await expect(input).toHaveCount(0);
    await tapClearOfActionDock(screen, button);
    await expect(input).toHaveValue(editor === 'metadata' ? SEEDED_OTHER_DREAM.title : SEEDED_OTHER_DREAM.transcript);
    await app.screenshot(`release-${editor}-other-entry-isolated`);
  });
}
