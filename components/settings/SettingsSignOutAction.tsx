import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { whileHeld } from '@/lib/attempt';
import { signOut } from '@/lib/auth';
import { TID } from '@/lib/testIDs';

/** The existing sign-out service, presented as a secondary footer action. */
export function SettingsSignOutAction() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);

  const attemptSignOut = async () => {
    if (loading || pending.current) return;
    setSubmitting(true);
    await whileHeld(pending, signOut, {
      catch: () => { setFailed(true); },
      finally: () => { setSubmitting(false); },
    });
  };

  if (!user) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.account.button.sign_out')}
        accessibilityState={{ disabled: loading || submitting, busy: submitting }}
        disabled={loading || submitting}
        onPress={() => void attemptSignOut()}
        className="min-h-12 items-center justify-center px-4 py-3"
        testID={TID.Button.AuthSignOut}
      >
        {submitting ? <ActivityIndicator color={colors.textSecondary} /> : (
          <Text className="font-sans-medium text-body leading-[20px] text-ivory-muted">
            {t('settings.account.button.sign_out')}
          </Text>
        )}
      </Pressable>
      <StandardBottomSheet
        visible={failed}
        onClose={() => setFailed(false)}
        title={t('settings.account.alert.signout_failed.title')}
        actions={{ primaryLabel: t('common.ok'), onPrimary: () => setFailed(false) }}
      />
    </>
  );
}
