import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test as base, type Device } from '@e2e-dev/mobile';
import { credentials, expect, type TestFixtures } from 'e2e';
import { readNativeBackendState, type NativeBackendState } from './native-backend-state';

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
  await screen.scrollUntilVisible(target, { direction });
  await target.tap();
}

export async function nativeHome(screen: TestFixtures['screen']) {
  // The detail header scrolls with its page; its absence from the viewport
  // does not mean the tab bar is available. Reach its back control first.
  if (await screen.getByTestId('screen.dreamDetail', { visible: true }).count()) {
    await nativeTap(screen, 'btn.navigateJournal', 'up');
  }
  const settingsBack = screen.getByTestId('settings.back', { visible: true });
  if (await settingsBack.count()) await settingsBack.tap();
  const recordingHome = screen.getByTestId('btn.recording.home', { visible: true });
  if (await recordingHome.count()) await recordingHome.tap();
  else await screen.getByTestId('tab.home', { visible: true }).tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
}

export async function nativeSettings(screen: TestFixtures['screen']) {
  if (await screen.getByTestId('screen.settings', { visible: true }).count()) return;
  await nativeHome(screen);
  await nativeTap(screen, 'btn.header.home.settings', 'up');
  await nativeTap(screen, 'quick-settings.all');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
}

async function nativeRecordingAfterAuth(screen: TestFixtures['screen']) {
  const onboarding = screen.getByTestId('screen.onboarding', { visible: true });
  const recording = screen.getByTestId('screen.recording', { visible: true });
  await expect.poll(async () => (await onboarding.count()) + (await recording.count())).toBeGreaterThan(0);
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
  await expect.poll(async () => await destinationCount()
    + (platform === 'ios' ? await pendingSpeechPermission.count() : 0)).toBeGreaterThan(0);
  if (platform === 'ios' && await pendingSpeechPermission.count()) {
    await screen.getByRole('button', 'Autoriser', { visible: true }).tap();
    await expect(pendingSpeechPermission).toHaveCount(0);
    await expect.poll(destinationCount).toBeGreaterThan(0);
  }
  // Onboarding may belong to an authenticated account after an interrupted
  // login. Reach Settings before clearing the container, including on iOS.
  if (await onboarding.count()) await nativeRecordingAfterAuth(screen);
  await nativeSettings(screen);
  const signOut = screen.getByTestId('btn.auth.signOut', { visible: true });
  // Settings is scrollable: locate the account action even if below the viewport.
  if (await screen.getByTestId('text.auth.email').count()) {
    await screen.scrollUntilVisible(signOut);
    await signOut.tap();
    await nativeRecordingAfterAuth(screen);
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
  await nativeTap(screen, 'quick-settings.close', 'up');
  await nativeSettings(screen);
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
  const { screen, device } = fixtures;
  const login = credentials.user(account === 'owner' ? 'nativeOwner' : 'nativeOther');
  await nativeSettings(screen);
  await nativeTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('input.auth.email', { visible: true }).fill(login.username);
  await screen.getByTestId('input.auth.password', { visible: true }).fill(login.password);
  await device.dismissKeyboard();
  await nativeTap(screen, 'btn.auth.signIn');
  await nativeRecordingAfterAuth(screen);
  await nativeSettings(screen);
  const email = screen.getByTestId('text.auth.email', { visible: true });
  await screen.scrollUntilVisible(email, { direction: 'up' });
  await expect(email).toContainText(login.username);
  await expect(screen.getByTestId('screen.subscription.qaLab')).toHaveCount(0);
}

export async function nativeSignOut(fixtures: NativeFixtures) {
  await nativeSettings(fixtures.screen);
  await nativeTap(fixtures.screen, 'btn.auth.signOut');
  await nativeRecordingAfterAuth(fixtures.screen);
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

export async function nativeSave(fixtures: NativeFixtures, story: string) {
  const { screen, device } = fixtures;
  await nativeCapture(screen);
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await device.dismissKeyboard();
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
  // Android exposes the decorative drop cap's inline object as U+FFFC after
  // the initial. Keep the entire story exact, permitting only that object.
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = Array.from(story)[0] ?? '';
  const expected = new RegExp(`^${escape(first)}\\uFFFC?${escape(story.slice(first.length))}$`);
  // A stable ID on the actual prose avoids both the identical title and
  // native flattening of the surrounding card's accessibility hierarchy.
  const text = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  await screen.scrollUntilVisible(text);
  await expect(text).toHaveText([expected]);
}
