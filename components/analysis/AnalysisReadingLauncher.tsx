import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Text } from 'react-native';

import { PressableScale } from '@/components/motion';
import { useTranslation } from '@/hooks/useTranslation';
import { AnalysisReadingModal, type AnalysisReadingModalProps } from './AnalysisReadingModal';

export type AnalysisReadingHandle = { open: () => void };

/** Keep open/close updates out of the dream detail tree. */
export const AnalysisReadingLauncher = forwardRef<AnalysisReadingHandle, Omit<AnalysisReadingModalProps, 'onClose'>>(
  function AnalysisReadingLauncher(props, ref) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

    return (
      <>
        <PressableScale onPress={() => setOpen(true)} accessibilityRole="button"
          testID="analysis.reading.open" className="min-h-[48px] justify-center self-start py-3">
          <Text className="font-sans-bold text-[15px] text-champagne-on">{t('analysis.reading.open')}</Text>
        </PressableScale>
        {open ? <AnalysisReadingModal {...props} onClose={() => setOpen(false)} /> : null}
      </>
    );
  },
);
