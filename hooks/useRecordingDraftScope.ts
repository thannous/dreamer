import { useAuth } from '@/context/AuthContext';
import { toAccountScope } from '@/lib/accountScope';
import type { RecordingDraftScope } from '@/lib/types';

/** Whose capture draft this is: `null` while the signed-in account is still unknown. */
export function useRecordingDraftScope(): RecordingDraftScope | null {
  const { user, loading } = useAuth();
  if (loading) return null;
  return toAccountScope(user?.id);
}
