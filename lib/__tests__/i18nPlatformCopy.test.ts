import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { getTranslator, loadTranslations } from '../i18n';

const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;
const STORE_COPY_KEYS = [
  'subscription.paywall.error.message',
  'settings.deleteAccount.subscriptionWarning',
] as const;

describe('platform-aware store copy', () => {
  const originalPlatform = Platform.OS;

  beforeAll(async () => {
    await Promise.all(LANGUAGES.map((language) => loadTranslations(language)));
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('resolves App Store or Apple subscription settings on iOS in every catalogue', () => {
    Platform.OS = 'ios';

    for (const language of LANGUAGES) {
      const t = getTranslator(language);
      for (const key of STORE_COPY_KEYS) {
        expect(t(key)).toMatch(/App Store|App-Store|Apple/i);
      }
    }
  });

  it('resolves Play Store or Google Play on Android in every catalogue', () => {
    Platform.OS = 'android';

    for (const language of LANGUAGES) {
      const t = getTranslator(language);
      for (const key of STORE_COPY_KEYS) {
        expect(t(key)).toMatch(/Play Store|Play-Store|Google Play|Google-Play/i);
      }
    }
  });
});
