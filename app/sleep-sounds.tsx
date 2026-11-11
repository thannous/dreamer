import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { SleepSoundsScreen } from '@/components/sleep/SleepSoundsScreen';
import { isSleepSoundsAvailable } from '@/lib/sleepSoundsFeature';

export default function SleepSoundsRoute() {
  if (!isSleepSoundsAvailable(Platform.OS)) {
    return <Redirect href="/" />;
  }

  return <SleepSoundsScreen />;
}
