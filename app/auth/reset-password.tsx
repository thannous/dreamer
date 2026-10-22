import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import ResetPasswordScreen from '@/components/auth/ResetPasswordScreen';
import { parseNativeRecoveryLink, type NativeRecoveryLink } from '@/lib/nativeRecoveryLink';

export default function ResetPasswordRoute() {
  const params = useLocalSearchParams();
  const { token_hash, type, code, access_token, refresh_token,
    provider_token, provider_refresh_token } = params;
  const incoming = Platform.OS === 'web' ? undefined : parseNativeRecoveryLink(params);
  const [captured, setCaptured] = useState<NativeRecoveryLink | undefined>(() => incoming);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const next = parseNativeRecoveryLink({ token_hash, type, code, access_token,
      refresh_token, provider_token, provider_refresh_token });
    if (next.state === 'none') return;
    // A second link can arrive while this route is mounted; retain its proof
    // before removing the only copy in router params.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaptured(next);
    // Keep the one-use proof in memory for the form; remove it from the
    // navigation route before the user enters a new password.
    try {
      router.setParams({
        token_hash: undefined, type: undefined, code: undefined,
        access_token: undefined, refresh_token: undefined,
        provider_token: undefined, provider_refresh_token: undefined,
      });
    } catch {
      // The isolated Auth client still prevents URL credentials from becoming
      // the app session if navigation is not ready to clear params yet.
    }
  }, [token_hash, type, code, access_token, refresh_token,
    provider_token, provider_refresh_token]);

  return <ResetPasswordScreen nativeRecoveryLink={captured ?? incoming} />;
}
