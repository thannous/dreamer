import { migrateLegacyDreamMutation } from './dreamUtils';
import type { DreamMutation } from './types';

export function parsePendingDreamMutationsPayload(
  payload: string | null | undefined,
  userScope?: string | null
): DreamMutation[] {
  if (!payload) {
    return [];
  }

  const parsed = JSON.parse(payload) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Pending dream mutation payload must be an array');
  }

  return parsed.map((entry) => {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'version' in entry &&
      (entry as { version?: unknown }).version === 1
    ) {
      const mutation = entry as Partial<DreamMutation>;
      const valid =
        typeof mutation.id === 'string' &&
        typeof mutation.userScope === 'string' &&
        (!userScope || mutation.userScope === userScope) &&
        mutation.entityType === 'dream' &&
        typeof mutation.entityKey === 'string' &&
        (mutation.operation === 'create' ||
          mutation.operation === 'update' ||
          mutation.operation === 'delete') &&
        typeof mutation.clientRequestId === 'string' &&
        typeof mutation.clientUpdatedAt === 'number' &&
        typeof mutation.payload === 'object' &&
        mutation.payload !== null &&
        (mutation.status === 'pending' ||
          mutation.status === 'sending' ||
          mutation.status === 'failed' ||
          mutation.status === 'acked' ||
          mutation.status === 'blocked') &&
        typeof mutation.retryCount === 'number' &&
        typeof mutation.createdAt === 'number';
      if (!valid) {
        throw new Error('Invalid pending dream mutation');
      }
      return mutation as DreamMutation;
    }

    if (!userScope) {
      throw new Error('Legacy pending dream mutation requires an account scope');
    }

    const migrated = migrateLegacyDreamMutation(entry as Record<string, unknown>, userScope);
    if (!migrated) {
      throw new Error('Invalid legacy pending dream mutation');
    }
    return migrated;
  });
}
