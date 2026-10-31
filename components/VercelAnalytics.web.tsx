import { Analytics } from '@vercel/analytics/react';
import { Platform } from 'react-native';

export function VercelAnalytics() {
  if (Platform.OS !== 'web') {
    return null;
  }

  return <Analytics />;
}
