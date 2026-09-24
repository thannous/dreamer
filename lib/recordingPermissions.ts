import { AppState, Platform } from 'react-native';

const PERMISSION_ACTIVITY_SETTLE_MS = 300;

export async function waitForPermissionActivityToSettle(signal?: AbortSignal): Promise<void> {
  if (Platform.OS === 'web' || signal?.aborted) return;

  // AppState.currentState is undefined in some test and SSR environments. On a
  // device it is populated. Both Android permission activities and iOS speech
  // dialogs must hand focus back before recognition and lifecycle cleanup start.
  if (AppState.currentState && AppState.currentState !== 'active') {
    await new Promise<void>((resolve) => {
      const finish = () => {
        subscription.remove();
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          finish();
        }
      });
      signal?.addEventListener('abort', finish, { once: true });
    });
  }

  if (AppState.currentState && !signal?.aborted) {
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, PERMISSION_ACTIVITY_SETTLE_MS);
      signal?.addEventListener('abort', finish, { once: true });
    });
  }
}
