import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { openApp } from '../test-support/open-app';
import { type NativeBackgroundFixtures, openBackgroundRoute } from '../dreamer-native-fixtures';

/**
 * `app.open()` relaunches the app. A link sent while it is still starting can reach it before
 * it listens for links: it then stays on Capture. A person opens the link from a started app.
 */
async function openStartedApp({ app, screen }: Pick<NativeBackgroundFixtures, 'app' | 'screen'>) {
  await openApp(app);
  await expect(screen.getByTestId(/^screen\.(onboarding|recording|home|settings)$/, { visible: true }).first()).toBeVisible();
}

// Recovered from the isolated security QA run. Use the canonical owned-device
// profile and supported scheme instead of a physical-phone-only local config.
const nativeRecoveryOptions = {
  tags: ['native-security-recovery'],
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true'
    ? 'Requires the owned synthetic Release profile.' : false,
};

test('Dreamer native security recovery rejects a bearer-shaped reset link', nativeRecoveryOptions, async (fixtures) => {
  const { screen } = fixtures;
  await openStartedApp(fixtures);
  await openBackgroundRoute(fixtures, 'auth/reset-password?type=recovery&access_token=qa-synthetic&refresh_token=qa-synthetic');
  await expect(screen.getByTestId('screen.auth.resetPassword')).toBeVisible();
  await expect(screen.getByText(/Ce lien n.est plus valide|This link is no longer valid/)).toBeVisible();
  await expect(screen.getByTestId('btn.auth.resetBackToSignIn')).toBeEnabled();
  await expect(screen.getByTestId('input.auth.recoveryEmail')).toBeHidden();
});

test('Dreamer native security recovery keeps a synthetic token-hash form inert', nativeRecoveryOptions, async (fixtures) => {
  const { screen } = fixtures;
  await openStartedApp(fixtures);
  await openBackgroundRoute(fixtures, 'auth/reset-password?type=recovery&token_hash=qa-synthetic-invalid');
  await expect(screen.getByTestId('screen.auth.resetPassword')).toBeVisible();
  await expect(screen.getByTestId('input.auth.recoveryEmail')).toBeVisible();
  await expect(screen.getByTestId('input.auth.newPassword')).toBeVisible();
  await expect(screen.getByTestId('btn.auth.updatePassword')).toBeDisabled();
});
