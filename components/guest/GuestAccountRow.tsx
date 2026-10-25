import { router } from 'expo-router';
import React from 'react';

import { NudgeRow } from '@/components/ui/NudgeRow';
import { QUOTAS } from '@/constants/limits';
import { useAuth } from '@/context/AuthContext';
import { useDreamsData } from '@/context/DreamsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isMockModeEnabled } from '@/lib/env';
import { isSupabaseConfigured } from '@/lib/supabase';
import { TID } from '@/lib/testIDs';

/** The screen asking, which decides what a free account is offered for there. */
export type GuestAccountReason = 'journal' | 'trends' | 'explore';

const ROWS: Record<GuestAccountReason, { icon: React.ComponentProps<typeof NudgeRow>['icon']; testID: string }> = {
  journal: { icon: 'lock.shield', testID: TID.Button.GuestAccountJournal },
  trends: { icon: 'sparkles', testID: TID.Button.GuestAccountTrends },
  explore: { icon: 'rectangle.stack.fill', testID: TID.Button.GuestAccountExplore },
};

/** Account creation, as the dream page's invitation and the capture limit open it. */
export const SIGN_UP_ROUTE = '/settings?section=account&auth=signup';

/**
 * A guest with a dream reads, on each screen, what happens there without an account,
 * then what a free account changes: a journal kept beyond this phone, monthly
 * analyses after the guest's lifetime ones, a collection that is not lost. It leaves
 * once signed in, and never shows where this build cannot create an account.
 */
export function GuestAccountRow({ reason, divider, className }: {
  reason: GuestAccountReason;
  divider?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { dreams, loaded } = useDreamsData();
  const { t } = useTranslation();
  if (user || (!isSupabaseConfigured && !isMockModeEnabled())) return null;
  // Before a first dream there is nothing yet for an account to keep.
  if (!loaded || dreams.length === 0) return null;

  return (
    <NudgeRow
      icon={ROWS[reason].icon}
      message={t(`guest.account.${reason}`, { count: QUOTAS.free.analysis ?? 0, guestCount: QUOTAS.guest.analysis ?? 0 })}
      cta={t('guest.account.cta')}
      onPress={() => router.push(SIGN_UP_ROUTE)}
      testID={ROWS[reason].testID}
      divider={divider}
      className={className}
    />
  );
}
