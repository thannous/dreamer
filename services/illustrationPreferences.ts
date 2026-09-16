import AsyncStorage from '@react-native-async-storage/async-storage';
import { isHdIllustrationsEnabled } from '@/lib/env';

export type IllustrationResolution = '1K' | '2K' | '4K';
const key = (userId: string) => `noctalia:illustration-resolution:${userId}`;

export async function getIllustrationResolution(userId?: string | null): Promise<IllustrationResolution> {
  if (!userId || !isHdIllustrationsEnabled()) return '1K';
  const value = await AsyncStorage.getItem(key(userId));
  return value === '2K' || value === '4K' ? value : '1K';
}

export async function saveIllustrationResolution(userId: string, value: IllustrationResolution) {
  if (!userId || !['1K', '2K', '4K'].includes(value)) throw new Error('Invalid illustration preference');
  await AsyncStorage.setItem(key(userId), value);
}
