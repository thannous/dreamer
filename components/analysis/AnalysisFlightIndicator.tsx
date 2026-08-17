import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MotiView } from '@/lib/moti';

// How long the completion pill stays on screen after the analysis settles.
const OUTCOME_VISIBLE_MS = 6000;

// Brief floating pill announcing a background analysis outcome. While the
// analysis runs, the Capture button in the bottom navigation carries the
// in-progress state instead, so nothing covers the screen content.
export function AnalysisFlightIndicator() {
  const { activeAnalysis, lastAnalysisOutcome } = useAnalysisActivity();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  // Marks which outcome (by completion timestamp) already had its display
  // window; set only from the timer so render stays pure.
  const [expiredOutcomeAt, setExpiredOutcomeAt] = useState<number | null>(null);

  useEffect(() => {
    if (activeAnalysis || !lastAnalysisOutcome) {
      return;
    }
    const outcomeAt = lastAnalysisOutcome.completedAt;
    const timeoutId = setTimeout(() => setExpiredOutcomeAt(outcomeAt), OUTCOME_VISIBLE_MS);
    return () => clearTimeout(timeoutId);
  }, [activeAnalysis, lastAnalysisOutcome]);

  const outcomeVisible =
    !activeAnalysis
    && lastAnalysisOutcome !== null
    && expiredOutcomeAt !== lastAnalysisOutcome.completedAt;

  // The recording flow shows its own immersive progress; the journal detail
  // already reflects the dream's live state.
  if (pathname === '/recording' || pathname.startsWith('/journal/')) {
    return null;
  }

  if (!outcomeVisible || !lastAnalysisOutcome) {
    return null;
  }

  const failed = lastAnalysisOutcome.status === 'failed';
  const label = failed ? t('analysis.indicator.failed') : t('analysis.indicator.done');
  const targetDreamId = lastAnalysisOutcome.dreamId;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + 8 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={label}
        onPress={() => {
          router.push(`/journal/${targetDreamId}`);
        }}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: noctalia.surface.raised,
            borderColor: noctalia.surface.borderStrong,
            shadowColor: noctalia.atmosphere.glow,
          },
          pressed && styles.pillPressed,
        ]}
      >
        <IconSymbol
          name={failed ? 'exclamationmark.triangle' : 'sparkles'}
          size={16}
          color={noctalia.accent.text}
        />
        <Text numberOfLines={1} style={[styles.label, { color: noctalia.text.primary }]}>
          {label}
        </Text>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 900,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '86%',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pillPressed: {
    opacity: 0.82,
  },
  label: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    flexShrink: 1,
  },
});
