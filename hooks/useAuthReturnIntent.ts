import { useEffect, useSyncExternalStore } from 'react';

import { isLucidTrainer } from '@/lib/appVariant';
import { AUTH_RETURN_TTL_MS, expireAuthReturn, getAuthReturnSnapshot, restoreAuthReturnIntent, subscribeAuthReturn } from '@/lib/authReturnIntent';
import { logger } from '@/lib/logger';

export function useAuthReturnIntent() {
  const snapshot = useSyncExternalStore(subscribeAuthReturn, getAuthReturnSnapshot, getAuthReturnSnapshot);
  useEffect(() => {
    if (isLucidTrainer) return;
    void restoreAuthReturnIntent().catch(() => {
      logger.warn('[AuthReturn] Unable to restore navigation intent');
    });
  }, []);
  useEffect(() => {
    if (isLucidTrainer || !snapshot.intent) return;
    const intent = snapshot.intent;
    const timer = setTimeout(() => {
      expireAuthReturn(intent);
    }, Math.max(0, intent.createdAt + AUTH_RETURN_TTL_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot.intent]);
  return isLucidTrainer ? { intent: null, ready: true } : snapshot;
}
