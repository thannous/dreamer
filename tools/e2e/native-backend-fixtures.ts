import { createRequire } from 'node:module';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test as base, type Device } from '@e2e-dev/mobile';
import { credentials, expect, type TestFixtures } from 'e2e';
import { readNativeBackendState, type NativeBackendState } from './native-backend-state';

const { Client } = createRequire(import.meta.url)('pg');

export type NativeFixtures = TestFixtures & { device: Device };
type Backend = {
  state: NativeBackendState; owner: SupabaseClient; other: SupabaseClient;
  setOnline(online: boolean): Promise<void>;
  transportState(): Promise<{ online: boolean; blocked: number; forwarded: number }>;
};

export const test = base.extend<{ backend: Backend }>({
  backend: async ({ platform, app, screen }, provide) => {
    if (!['ios', 'android'].includes(platform) || process.env.E2E_NATIVE_MOCK_MODE !== 'false')
      throw new Error('These journeys require the identified local-backend Release, with real Auth and storage.');
    const state = readNativeBackendState();
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(state.status.API_URL, state.status.SERVICE_ROLE_KEY, options);
    const owner = createClient(state.status.API_URL, state.status.ANON_KEY, options);
    const other = createClient(state.status.API_URL, state.status.ANON_KEY, options);
    const transport = async (path: string, online?: boolean) => {
      const response = await fetch(`${state.proxy.origin}/__control/${path}`, {
        method: online === undefined ? 'GET' : 'POST',
        headers: { 'x-e2e-control-token': state.proxy.controlToken, 'content-type': 'application/json' },
        ...(online === undefined ? {} : { body: JSON.stringify({ online }) }),
      });
      if (!response.ok) throw new Error(`Owned proxy control failed (${response.status}).`);
      return response.json();
    };
    const setOnline = async (online: boolean) => { expect((await transport('network', online)).online).toBe(online); };
    try {
      await setOnline(true);
      // End the preceding app process and clear its owned queue before deleting
      // server fixtures; otherwise a late retry can recreate a deleted dream.
      await nativeGuest({ app, screen, platform });
      for (const [name, client] of [['owner', owner], ['other', other]] as const) {
        const auth = await client.auth.signInWithPassword(state.accounts[name]);
        expect(auth.error).toBeNull();
        expect(auth.data.user?.id).toBe(state.accounts[name].id);
        // Only the two accounts created by this live disposable stack are cleaned.
        const remove = await client.from('dreams').delete().eq('user_id', state.accounts[name].id);
        expect(remove.error).toBeNull();
        // Deleting dreams deliberately preserves spent credits in the product.
        // A new isolated fixture starts with a clean ledger for these owned users only.
        const quota = await admin.from('quota_usage').delete().eq('user_id', state.accounts[name].id);
        expect(quota.error).toBeNull();
      }
      // Creation limits survive dream deletion too. The product denies Data API
      // access even to service_role; reset only these disposable users through
      // the same guarded loopback database, after their app queue is cleared.
      const db = new Client({ connectionString: state.status.DB_URL });
      try {
        await db.connect();
        await db.query('delete from public.dream_creation_buckets where user_id = any($1::uuid[])',
          [[state.accounts.owner.id, state.accounts.other.id]]);
      } finally {
        await db.end();
      }
      await provide({ state, owner, other, setOnline, transportState: () => transport('state') });
    } finally {
      await setOnline(true);
      await owner.auth.signOut({ scope: 'local' });
      await other.auth.signOut({ scope: 'local' });
    }
  },
});

export async function nativeTap(screen: TestFixtures['screen'], id: string, direction: 'up' | 'down' = 'down') {
  const target = screen.getByTestId(id, { visible: true });
  if (id.startsWith('quick-settings.')) {
    // On a wide screen the drawer occupies only the right side. A viewport
    // swipe starts on its dimmed backdrop and closes it instead of scrolling.
    const drawer = screen.getByTestId('quick-settings.drawer', { visible: true });
    await expect(drawer).not.toBeHidden();
    await drawer.scrollUntilVisible(target, { direction });
  } else {
    await screen.scrollUntilVisible(target, { direction });
  }
  await target.tap();
}

export async function nativeHome(screen: TestFixtures['screen']) {
  // A retained QA installation can show the current release notes on launch.
  // Dismiss through its real control before touching the navigation underneath.
  const releaseNotes = screen.getByTestId('modal.whatsNew', { visible: true });
  if (await releaseNotes.count()) {
    await screen.getByTestId('btn.whatsNew.close', { visible: true }).tap();
    await expect(releaseNotes).toHaveCount(0);
  }
  // The detail header scrolls with its page; its absence from the viewport
  // does not mean the tab bar is available. Reach its back control first.
  if (await screen.getByTestId('screen.dreamDetail', { visible: true }).count()) {
    await nativeTap(screen, 'btn.navigateJournal', 'up');
  }
  const settingsBack = screen.getByTestId('settings.back', { visible: true });
  if (await settingsBack.count()) await settingsBack.tap();
  const home = screen.getByTestId('screen.home', { visible: true });
  // Native Modal can leave its accessibility tree before its fade finishes.
  // Home navigation is idempotent, so confirm arrival instead of sleeping.
  await expect.poll(async () => {
    if (await home.count()) return true;
    const recordingHome = screen.getByTestId('btn.recording.home', { visible: true });
    const homeTab = screen.getByTestId('tab.home', { visible: true });
    if (await recordingHome.count()) await recordingHome.tap();
    else if (await homeTab.count()) await homeTab.tap();
    return (await home.count()) === 1;
  }).toBe(true);
}

export async function nativeSettings(screen: TestFixtures['screen']) {
  if (await screen.getByTestId('screen.settings', { visible: true }).count()) return;
  await nativeHome(screen);
  await nativeTap(screen, 'btn.header.home.settings', 'up');
  await nativeTap(screen, 'quick-settings.all');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
}

async function nativeDestinationAfterPasswordPrompt(
  screen: TestFixtures['screen'],
  platform: TestFixtures['platform'],
  destinationCount: () => Promise<number>,
) {
  // iOS may offer to store these disposable credentials after sign-in submits.
  // Match the complete observed password-saving title, never a generic alert.
  const prompt = screen.getByText(/^Enregistrer le mot de passe\s*\?$/, { visible: true });
  await expect.poll(async () => await destinationCount()
    + (platform === 'ios' ? await prompt.count() : 0)).toBeGreaterThan(0);
  if (platform === 'ios' && await prompt.count()) {
    const later = screen.getByRole('button', 'Plus tard', { visible: true });
    await expect(later).toHaveCount(1);
    await later.tap();
    await expect(prompt).toHaveCount(0);
    await expect.poll(destinationCount).toBeGreaterThan(0);
  }
}

async function nativeRecordingAfterAuth(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  const onboarding = screen.getByTestId('screen.onboarding', { visible: true });
  const recording = screen.getByTestId('screen.recording', { visible: true });
  await nativeDestinationAfterPasswordPrompt(screen, platform,
    async () => (await onboarding.count()) + (await recording.count()));
  if (await onboarding.count()) {
    // Onboarding is scoped to an account. A second account intentionally does
    // not inherit the guest's completion; take its normal UI exit if presented.
    const next = screen.getByTestId('btn.onboarding.intro.next', { visible: true });
    if (await next.count()) await next.tap();
    const skip = screen.getByTestId('btn.onboarding.skip', { visible: true });
    await expect(skip).toBeEnabled();
    await skip.tap();
  }
  await expect(recording).toBeVisible();
}

export async function nativeGuest({ app, screen, platform }: Pick<NativeFixtures, 'app' | 'screen' | 'platform'>) {
  await app.open();
  // iOS clearing an app container preserves SecureStore's Keychain entry. Use
  // the app's own sign-out first; never reset the whole simulator's Keychain.
  const onboarding = screen.getByTestId('screen.onboarding', { visible: true });
  const destinationCount = async () => (await onboarding.count())
    + (await screen.getByTestId('screen.recording', { visible: true }).count())
    + (await screen.getByTestId('screen.home', { visible: true }).count());
  // A failed speech pilot can leave this exact owned-app OS dialog above the
  // next launch. Match its complete observed title; never accept other alerts.
  const pendingSpeechPermission = screen.getByRole('alert',
    /^Autoriser «\s*Noctalia QA\s*» à accéder aux propos tenus grâce à la reconnaissance vocale\s*\?$/,
    { visible: true });
  await nativeDestinationAfterPasswordPrompt(screen, platform, async () => await destinationCount()
    + (platform === 'ios' ? await pendingSpeechPermission.count() : 0));
  if (platform === 'ios' && await pendingSpeechPermission.count()) {
    await screen.getByRole('button', 'Autoriser', { visible: true }).tap();
    await expect(pendingSpeechPermission).toHaveCount(0);
    await nativeDestinationAfterPasswordPrompt(screen, platform, destinationCount);
  }
  // An interrupted Tell draft can ask again on launch. Resolve its consent
  // before navigating to sign-out; tapping a tab behind the modal only declines.
  const initialConsent = screen.getByTestId('modal.aiConsent', { visible: true });
  if (await initialConsent.count()) {
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(initialConsent).toHaveCount(0);
    const home = screen.getByTestId('screen.home', { visible: true });
    const homeTab = screen.getByTestId('tab.home', { visible: true });
    // Navigation is idempotent while the native modal finishes its fade.
    await expect.poll(async () => {
      if (await home.count()) return true;
      if (await homeTab.count()) await homeTab.tap();
      return (await home.count()) === 1;
    }).toBe(true);
  }
  // Onboarding may belong to an authenticated account after an interrupted
  // login. Reach Settings before clearing the container, including on iOS.
  if (await onboarding.count()) await nativeRecordingAfterAuth(screen, platform);
  await nativeSettings(screen);
  const signOut = screen.getByTestId('btn.auth.signOut', { visible: true });
  // Settings is scrollable: locate the account action even if below the viewport.
  if (await screen.getByTestId('text.auth.email').count()) {
    await screen.scrollUntilVisible(signOut);
    await signOut.tap();
    await nativeRecordingAfterAuth(screen, platform);
  }
  // run.mjs verifies the named disposable emulator/Simulator and Release receipt before this fixture.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await nativeHome(screen);
  await nativeTap(screen, 'btn.header.home.settings', 'up');
  await nativeTap(screen, 'quick-settings.language');
  await nativeTap(screen, 'quick-settings.language.en');
  if (platform === 'android' && await screen.getByText('Language Pack for Voice Recording', { visible: true }).count())
    await screen.getByRole('button', 'Cancel', { visible: true }).tap();
  await expect(screen.getByRole('radio', 'English', { visible: true })).toBeChecked();
  // Continue through the drawer already open, without closing and reopening it.
  await nativeTap(screen, 'quick-settings.all');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  const signIn = screen.getByTestId('settings-account-open-signin', { visible: true });
  await screen.scrollUntilVisible(signIn, { direction: 'up' });
  // A positive guest account action, alongside no account identity, proves the fixture's scope.
  await expect(signIn).toBeVisible();
  await expect(screen.getByTestId('text.auth.email')).toHaveCount(0);
  await nativeCapture(screen);
}

export async function nativeCapture(screen: TestFixtures['screen']) {
  if (!(await screen.getByTestId('screen.recording', { visible: true }).count())) {
    await nativeHome(screen);
    await screen.getByTestId('tab.addDream', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const textMode = screen.getByTestId('btn.recording.inputMode.text', { visible: true });
  if (await textMode.count()) await textMode.tap();
  await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toBeVisible();
}

export async function nativeLogin(fixtures: NativeFixtures, account: 'owner' | 'other' = 'owner') {
  const { screen, device, platform } = fixtures;
  const login = credentials.user(account === 'owner' ? 'nativeOwner' : 'nativeOther');
  await nativeSettings(screen);
  await nativeTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('input.auth.email', { visible: true }).fill(login.username);
  const password = screen.getByTestId('input.auth.password', { visible: true });
  await password.fill(login.password);
  // Return can leave its native command waiting behind iOS's password-saving
  // prompt even though sign-in was dispatched. Submit once through the normal
  // button, then let the exact known-prompt handler verify the destination.
  await device.dismissKeyboard();
  await nativeTap(screen, 'btn.auth.signIn');
  await nativeRecordingAfterAuth(screen, platform);
  await nativeSettings(screen);
  const email = screen.getByTestId('text.auth.email', { visible: true });
  await screen.scrollUntilVisible(email, { direction: 'up' });
  await expect(email).toContainText(login.username);
  await expect(screen.getByTestId('screen.subscription.qaLab')).toHaveCount(0);
}

export async function nativeSignOut(fixtures: NativeFixtures) {
  await nativeSettings(fixtures.screen);
  await nativeTap(fixtures.screen, 'btn.auth.signOut');
  await nativeRecordingAfterAuth(fixtures.screen, fixtures.platform);
}

export async function nativeJournal(screen: TestFixtures['screen']) {
  if (await screen.getByTestId('screen.dreamDetail', { visible: true }).count()) {
    await nativeTap(screen, 'btn.navigateJournal', 'up');
  } else if (!(await screen.getByTestId('screen.journal', { visible: true }).count())) {
    await nativeHome(screen);
    await screen.getByTestId('tab.journal', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
}

// e2e mobile 0.12.4 (#1305) refuses the generic iPhone keyboard drag when every
// point above the keyboard is a control, which is the case once Capture has text.
// Capture's scroll view uses keyboardShouldPersistTaps="handled", so a tap on its
// static header title closes it like a dreamer
// would. Content lower on the screen can sit under the keyboard and type a key.
// After a fill the keyboard can still be sliding in: a title tap before it is up
// closes nothing and the editor keeps focus. So the helper waits for the
// keyboard's own Return key, taps once, and requires that key gone. Callers that
// did not type (an empty Capture just opened) pass `afterFill: false`: no keyboard
// is expected there, only an unfocused editor.
export async function nativeDismissCaptureKeyboard(fixtures: NativeFixtures, { afterFill = true } = {}) {
  const { screen, device, platform } = fixtures;
  if (platform !== 'ios') {
    await device.dismissKeyboard();
    return;
  }
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  const keyboardReturn = screen.getByTestId('Return', { visible: true });
  const before = await editor.inputValue();
  if (afterFill) await expect(keyboardReturn).toBeVisible();
  const title = screen.getByText(/^Capture$/, { visible: true });
  // Filling the compact Duo editor can scroll its header out of view.
  await screen.scrollUntilVisible(title, { direction: 'up' });
  // A stable fresh observation retires the ref captured while the iOS keyboard
  // was moving; agent-device refuses to dispatch that unconfirmed old frame.
  await expect(title).not.toBeHidden();
  await title.tap();
  await expect(keyboardReturn).toBeHidden();
  await expect(editor).not.toBeFocused();
  await expect(editor).toHaveValue(before);
}

export async function nativeSave(fixtures: NativeFixtures, story: string) {
  const { screen } = fixtures;
  await nativeCapture(screen);
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await nativeDismissCaptureKeyboard(fixtures);
  await nativeTap(screen, 'btn.saveDream');
  const later = screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true });
  const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
  await expect.poll(async () => (await later.count()) + (await detail.count())).toBeGreaterThan(0);
  if (await later.count()) await later.tap();
  await nativeTranscript(screen, story);
}

export async function nativeTranscript(screen: TestFixtures['screen'], story: string) {
  const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
  await expect(detail).toBeVisible();
  // Native exposes the decorative drop cap's inline object as U+FFFC after
  // the initial. e2e text matchers collapse Unicode whitespace, including
  // paragraph breaks; preserve every word and allow only that inline object.
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalizedStory = story.replace(/\s+/gu, ' ').trim();
  const first = Array.from(normalizedStory)[0] ?? '';
  const expected = new RegExp(`^${escape(first)}\\uFFFC?${escape(normalizedStory.slice(first.length))}$`);
  // A stable ID on the actual prose avoids both the identical title and
  // native flattening of the surrounding card's accessibility hierarchy.
  const text = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  await screen.scrollUntilVisible(text);
  await expect(text).toHaveText([expected]);
}
