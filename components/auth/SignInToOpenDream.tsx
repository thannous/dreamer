import React, { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { router } from 'expo-router';

import { useTranslation } from '@/hooks/useTranslation';
import { requestAuthReturn } from '@/lib/authReturnIntent';
import { clearReturnToPaywallIntent } from '@/lib/navigationIntents';

export function SignInToOpenDream({ destination }: { destination: string | null }) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  if (!destination) return null;

  const openSignIn = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await requestAuthReturn(destination);
      clearReturnToPaywallIntent();
      router.replace('/(tabs)/settings');
    } catch {
      Alert.alert(t('common.error_title'), t('common.unknown_error'));
      setOpening(false);
    }
  };

  return (
    <Pressable
      testID="auth.open-requested-dream"
      accessibilityRole="button"
      accessibilityState={{ disabled: opening, busy: opening }}
      disabled={opening}
      onPress={() => { void openSignIn(); }}
      className="mt-4 min-h-12 items-center justify-center rounded-sm border border-line px-6 py-3"
    >
      <Text className="font-sans-bold text-[16px] text-ivory">
        {t('settings.account.button.sign_in')}
      </Text>
    </Pressable>
  );
}
