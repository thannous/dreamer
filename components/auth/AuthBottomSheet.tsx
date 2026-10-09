import React from 'react';

import LucidAuthBottomSheet from '@/components/lucid/LucidAuthBottomSheet';
import { StandardBottomSheet, type StandardBottomSheetProps } from '@/components/ui/StandardBottomSheet';
import { isLucidTrainer } from '@/lib/appVariant';

export type AuthBottomSheetProps = StandardBottomSheetProps & {
  actions: NonNullable<StandardBottomSheetProps['actions']>;
};

export function AuthBottomSheet(props: AuthBottomSheetProps) {
  return isLucidTrainer ? <LucidAuthBottomSheet {...props} /> : <StandardBottomSheet {...props} />;
}
