import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { getStaleAnalysisBannerDismissed, saveStaleAnalysisBannerDismissed } from '@/services/storageService';

/**
 * Says that the dream changed since its analysis. Closed once for good: the next-step card
 * keeps offering the update. Whether it was closed is read once, the first time it would
 * show: most pages never ask. It stays mounted while `visible` is false, so a banner closed
 * during this visit stays closed even when the choice could not be stored.
 */
export function StaleAnalysisBanner({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  // null: not read yet.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const unread = visible && dismissed === null;
  useEffect(() => {
    if (!unread) return undefined;
    let active = true;
    getStaleAnalysisBannerDismissed()
      .then((stored) => { if (active) setDismissed(stored); })
      .catch(() => { if (active) setDismissed(false); });
    return () => { active = false; };
  }, [unread]);

  if (!visible || dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    saveStaleAnalysisBannerDismissed(true).catch(() => {
      // Closed for this visit; it may reappear next time.
    });
  };

  return (
    <View
      testID={TID.Component.AnalysisStaleBanner}
      className="mb-[18px] gap-3 rounded-lg border border-warning-line bg-warning p-4"
    >
      <View className="flex-row items-start gap-3">
        <IconSymbol name="exclamationmark.triangle.fill" size={20} color={noctalia.status.warning.icon} />
        <View className="flex-1 gap-1">
          <Text className="font-sans-bold text-[11px] uppercase text-warning-on">
            {t('journal.detail.stale.label')}
          </Text>
          <Text
            className="font-sans text-[13px] leading-[18px] text-warning-on"
            testID={TID.Text.AnalysisStaleBanner}
          >
            {t('journal.detail.stale.banner')}
          </Text>
        </View>
        <PressableScale
          testID={TID.Button.AnalysisStaleDismiss}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('journal.detail.stale.dismiss')}
          className="-m-2.5 h-11 w-11 items-center justify-center"
        >
          <IconSymbol name="xmark" size={16} color={noctalia.status.warning.icon} />
        </PressableScale>
      </View>
    </View>
  );
}
