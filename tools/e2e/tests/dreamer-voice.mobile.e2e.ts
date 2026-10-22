import { test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { injectAndroidMicrophone, voiceInputUnavailable } from '../native-voice-input';
import { nativeGuest, nativeJournal, nativeTranscript } from '../native-backend-fixtures';

type VoiceFixtures = TestFixtures & { device: Device };
const profileUnavailable = process.env.E2E_NATIVE_MOCK_MODE !== 'false' || !process.env.E2E_NATIVE_BACKEND_MANIFEST
  ? 'Requires the identified owned local-backend Release; native speech is not mocked.' : false;
const options = { platforms: ['ios', 'android'], tags: ['native-voice', 'native-priority'], timeout: 240_000, skip: profileUnavailable };

async function tap(screen: TestFixtures['screen'], id: string, direction: 'up' | 'down' = 'down') {
  const locator = screen.getByTestId(id, { visible: true });
  await screen.scrollUntilVisible(locator, { direction });
  await locator.tap();
}

async function prepareVoice(fixtures: VoiceFixtures) {
  // A preceding account/recovery journey can leave an iOS SecureStore session.
  // The shared fixture signs out normally before resetting this owned QA app,
  // asserts its guest identity, sets English, and opens an empty text capture.
  await nativeGuest(fixtures);
  await fixtures.device.dismissKeyboard();
  await expect(fixtures.screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue('');
}

async function startMicrophone({ screen }: VoiceFixtures) {
  await tap(screen, 'btn.recordToggle');
  const rationale = screen.getByTestId('sheet.recording.micRationale', { visible: true });
  if (await rationale.count()) await tap(screen, 'btn.recording.micRationale.allow');
}

async function expectSavedOnceAfterRestart({ app, screen, device }: VoiceFixtures, story: string) {
  await tap(screen, 'btn.saveDream');
  const readLater = screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true });
  const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
  await expect.poll(async () => (await readLater.count()) + (await detail.count())).toBeGreaterThan(0);
  if (await readLater.count()) await readLater.tap();
  await nativeTranscript(screen, story);
  await nativeJournal(screen);
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  await app.restart();
  // Observe the fresh foreground destination before using the normal navigation.
  // Capture's bottom navigation is available with the keyboard closed.
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await device.dismissKeyboard();
  await nativeJournal(screen);
  const cards = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(cards).toHaveCount(1);
  await cards.tap();
  await nativeTranscript(screen, story);
  await app.screenshot('native-voice-corrected-story-durable');
}

test('Dreamer native denied microphone preserves typed fallback through reauthorization and restart', {
  ...options, tags: [...options.tags, 'native-microphone-permission'],
}, async fixtures => {
  const { app, screen, device, platform } = fixtures;
  await prepareVoice(fixtures);
  const draft = 'Voice permission fixture: a purple garden beside the sea.';
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  await editor.fill(draft);
  await device.dismissKeyboard();
  // Leaving Capture flushes the current draft before the OS may kill the process.
  await device.home();
  await device.setPermission('microphone', 'deny');
  await app.open();
  await expect(editor).toHaveValue(draft);
  try {
    await startMicrophone(fixtures);
    if (platform === 'android') {
      // Android revocation asks again; actually deny its runtime permission prompt.
      const deny = screen.getByTestId('permission_deny_button', { visible: true });
      await expect(deny).toBeVisible();
      await deny.tap();
    }
    await expect(screen.getByText('Microphone permission is required to record dreams.', { visible: true })).toBeVisible();
    await device.alert('accept');
    await expect(screen.getByTestId('recording-write-listening-status')).toHaveCount(0);
    await expect(editor).toHaveValue(draft);
    await expect(screen.getByTestId('btn.saveDream', { visible: true })).toBeEnabled();
    await app.screenshot('native-voice-denied-draft-preserved');
    // OS permission changes terminate iOS; reopen before claiming preservation.
    await device.setPermission('microphone', 'grant');
    await app.open();
    await expect(editor).toHaveValue(draft);
    const corrected = `${draft} I added this sentence after allowing the microphone.`;
    await editor.fill(corrected);
    await device.dismissKeyboard();
    await expectSavedOnceAfterRestart(fixtures, corrected);
  } finally {
    // Only the owned QA app permission is reset; no host audio settings are changed.
    await device.setPermission('microphone', 'reset');
  }
});

test('Dreamer native real microphone dictation is recognized before correction and saved exactly once', {
  ...options,
  tags: [...options.tags, 'native-real-dictation'],
  skip: profileUnavailable || (process.env.E2E_NATIVE_QA_AUDIO === 'true'
    ? 'This build feeds an audio file to the recognizer; it does not qualify microphone injection.' : false)
    || voiceInputUnavailable(process.env.E2E_PLATFORM ?? ''),
}, async fixtures => {
  const { app, screen, device } = fixtures;
  await prepareVoice(fixtures);
  await device.setPermission('microphone', 'grant');
  await app.open();
  try {
    await startMicrophone(fixtures);
    await expect(screen.getByTestId('recording-write-listening-status', { visible: true })).toBeVisible();
    // The fixture enters the emulator microphone, exercising the actual speech
    // service and app listeners. Never fill the editor before these assertions.
    await injectAndroidMicrophone();
    const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
    await expect(editor).toHaveValue(/blue lighthouse/i);
    await expect(editor).toHaveValue(/golden boat/i);
    await expect(editor).toHaveValue(/(?:seven|7) windows/i);
    await app.screenshot('native-real-speech-before-any-text-edit');
    await tap(screen, 'btn.recordToggle');
    await expect(screen.getByTestId('recording-write-listening-status')).toHaveCount(0);
    const recognized = await editor.inputValue();
    const corrected = recognized.replace(/blue lighthouse/i, 'green lighthouse') + ' I felt peaceful when I woke up.';
    await editor.fill(corrected);
    await device.dismissKeyboard();
    await expect(editor).toHaveValue(corrected);
    await expectSavedOnceAfterRestart(fixtures, corrected);
  } finally {
    // Revoking the app's permission also stops capture if a preceding assertion failed.
    await device.setPermission('microphone', 'reset');
  }
});


test('Dreamer native system speech recognizes a QA audio file before correction and durable save', {
  ...options,
  tags: [...options.tags, 'native-speech-file'],
  skip: profileUnavailable || (process.env.E2E_NATIVE_QA_AUDIO !== 'true'
    ? 'Requires the guarded local QA audioSource build; this is file-transcription evidence, not microphone capture.' : false),
}, async fixtures => {
  const { app, screen, device, platform } = fixtures;
  await prepareVoice(fixtures);
  await device.setPermission('microphone', 'grant');
  await app.open();
  try {
    await startMicrophone(fixtures);
    const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
    if (platform === 'ios') {
      // iOS may separately request speech authorization even with microphone access.
      const speechPrompt = screen.getByText(/(?:Access Speech Recognition|Speech Recognition|reconnaissance vocale)/i, { visible: true });
      await expect.poll(async () => (await speechPrompt.count()) > 0
        || (await screen.getByTestId('recording-write-listening-status', { visible: true }).count()) > 0
        || /blue lighthouse/i.test(await editor.inputValue()), { timeout: 30_000 }).toBe(true);
      if (await speechPrompt.count()) await device.alert('accept');
    }
    // No text is supplied before all three landmarks came from the native recognizer.
    await expect(editor).toHaveValue(/blue lighthouse/i);
    await expect(editor).toHaveValue(/golden boat/i);
    await expect(editor).toHaveValue(/(?:seven|7) windows/i);
    await app.screenshot('native-speech-file-recognized-before-text-edit');
    // The file can complete by itself. If it is still listening, stop through the
    // same control; never tap an already-stopped microphone and start a new pass.
    if (await screen.getByTestId('recording-write-listening-status', { visible: true }).count()) {
      await tap(screen, 'btn.recordToggle');
    }
    await expect(screen.getByTestId('recording-write-listening-status')).toHaveCount(0);
    const recognized = await editor.inputValue();
    expect(recognized.match(/blue lighthouse/gi)).toHaveLength(1);
    const corrected = recognized.replace(/blue lighthouse/i, 'green lighthouse') + ' I felt peaceful when I woke up.';
    await editor.fill(corrected);
    await device.dismissKeyboard();
    await expectSavedOnceAfterRestart(fixtures, corrected);
  } finally {
    await device.setPermission('microphone', 'reset');
  }
});
