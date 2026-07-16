import { Redirect } from 'expo-router';

import { SleepSoundsScreen } from '@/components/sleep/SleepSoundsScreen';
import { isSleepSoundsAvailable } from '@/lib/sleepSoundsFeature';

export default function SleepSoundsRoute() {
  if (!isSleepSoundsAvailable()) {
    return <Redirect href="/" />;
  }

  return <SleepSoundsScreen />;
}
