import { SpeedInsights } from '@vercel/speed-insights/react';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';

export function VercelSpeedInsights() {
  const pathname = usePathname();

  if (Platform.OS !== 'web') {
    return null;
  }

  return <SpeedInsights pathname={pathname} />;
}
