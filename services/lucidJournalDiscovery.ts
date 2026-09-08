import { Linking, Platform } from 'react-native';

import { getLucidKeyValueStorage } from '@/services/lucidKeyValueStorage';

// Device preference, deliberately outside account state and sync/export queues.
const HIDDEN_KEY = 'noctalia_lucid_discovery:journal_hidden_v1';
export const JOURNAL_APP_URL = 'noctalia://journal';
export const JOURNAL_WEBSITE_URL = 'https://noctalia.app/';

export async function isJournalDiscoveryVisible(): Promise<boolean> {
  try {
    // Unknown/corrupt values also fail closed: a promotion never wins over privacy.
    return (await getLucidKeyValueStorage().getItem(HIDDEN_KEY)) === null;
  } catch {
    return false;
  }
}

export async function hideJournalDiscovery(): Promise<void> {
  await getLucidKeyValueStorage().setItem(HIDDEN_KEY, 'hidden');
}

export async function openJournalDiscovery(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      // Attempt directly: canOpenURL needs extra platform query declarations.
      await Linking.openURL(JOURNAL_APP_URL);
      return;
    } catch {
      // Missing app or unavailable native link: the official website is sufficient.
    }
  }
  await Linking.openURL(JOURNAL_WEBSITE_URL);
}
