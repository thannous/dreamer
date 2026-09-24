import { AppState, Platform } from 'react-native';

const PERMISSION_ACTIVITY_SETTLE_MS = 300;

export async function waitForPermissionActivityToSettle(): Promise<void> {
  if (Platform.OS === 'web') return;

  // AppState.currentState is undefined in some test and SSR environments. On a
  // device it is populated. Both Android permission activities and iOS speech
  // dialogs must hand focus back before recognition and lifecycle cleanup start.
  if (AppState.currentState && AppState.currentState !== 'active') {
    await new Promise<void>((resolve) => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          subscription.remove();
          resolve();
        }
      });
    });
  }

  if (AppState.currentState) {
    await new Promise((resolve) => setTimeout(resolve, PERMISSION_ACTIVITY_SETTLE_MS));
  }
}
