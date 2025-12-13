import { Platform } from 'react-native';

import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Linking from 'expo-linking';

type ExpoIntentLauncherModule = {
  startActivity?: (activityAction: string, params: Record<string, unknown>) => Promise<unknown>;
};

const GOOGLE_APP_PACKAGE = 'com.google.android.googlequicksearchbox';
const GOOGLE_VOICE_SETTINGS_COMPONENTS = [
  {
    packageName: 'com.google.android.googlequicksearchbox',
    className: 'com.google.android.apps.gsa.settingsui.VoiceSearchPreferences',
  },
  {
    packageName: 'com.google.android.voicesearch',
    className: 'com.google.android.voicesearch.VoiceSearchPreferences',
  },
  {
    packageName: 'com.google.android.googlequicksearchbox',
    className: 'com.google.android.voicesearch.VoiceSearchPreferences',
  },
  {
    packageName: 'com.google.android.googlequicksearchbox',
    className: 'com.google.android.apps.gsa.velvet.ui.settings.VoiceSearchPreferences',
  },
];

async function tryStartAndroidActivity(action: string, params: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const launcher = requireOptionalNativeModule<ExpoIntentLauncherModule>('ExpoIntentLauncher');
    if (!launcher?.startActivity) return false;
    await launcher.startActivity(action, params);
    return true;
  } catch {
    return false;
  }
}

export async function openSpeechRecognitionLanguageSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const opened =
      (await tryStartAndroidActivity('android.settings.VOICE_INPUT_SETTINGS')) ||
      (await tryStartAndroidActivity('android.settings.SETTINGS'));
    if (opened) return;
  }

  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}

export async function openGoogleAppSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const opened = await tryStartAndroidActivity('android.settings.APPLICATION_DETAILS_SETTINGS', {
    data: `package:${GOOGLE_APP_PACKAGE}`,
  });
  if (opened) return;

  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}

export async function openGoogleVoiceSettingsBestEffort(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  for (const component of GOOGLE_VOICE_SETTINGS_COMPONENTS) {
    const opened = await tryStartAndroidActivity('android.intent.action.MAIN', {
      packageName: component.packageName,
      className: component.className,
    });
    if (opened) return true;
  }

  await openSpeechRecognitionLanguageSettings();
  return false;
}
