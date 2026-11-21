import { getApiBaseUrl } from '@/lib/config';
import { isMockModeEnabled } from '@/lib/env';

/**
 * A development build talking to the local development backend
 * (tools/dev-local, plain HTTP on this network). Only that server serves the
 * guest reset and the Simulator guest session; a release build never uses them.
 */
export function isLocalDevelopmentBackend(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ &&
    !isMockModeEnabled() && getApiBaseUrl().startsWith('http://');
}
