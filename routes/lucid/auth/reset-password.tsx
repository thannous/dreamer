import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import ResetPasswordScreen from '@/components/auth/ResetPasswordScreen';
import { parseNativeRecoveryLink } from '@/lib/nativeRecoveryLink';

export default function LucidResetPassword() {
  const params = useLocalSearchParams();
  return <ResetPasswordScreen nativeRecoveryLink={
    Platform.OS === 'web' ? undefined : parseNativeRecoveryLink(params)
  } />;
}
