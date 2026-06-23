import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import type { ClassifiedError } from '@/lib/errors';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface AnalysisProgressProps {
  step: AnalysisStep;
  progress: number; // 0-100
  message: string;
  error: ClassifiedError | null;
  onRetry?: () => void;
}

export function AnalysisProgress({ step, progress, message, error, onRetry }: AnalysisProgressProps) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const showError = step === AnalysisStep.ERROR && error;
  const roundedProgress = Math.round(progress);

  return (
    <View
      style={[styles.container, { backgroundColor: noctalia.surface.active, borderColor: noctalia.surface.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: roundedProgress }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={showError ? t('analysis.step.error') : t('analysis.step.analyzing')}
    >
      {/* Progress Bar */}
      {!showError && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: noctalia.surface.soft }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: noctalia.action.primary },
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: noctalia.text.primary }]}>{roundedProgress}%</Text>
        </View>
      )}

      {/* Status Message */}
      <View style={styles.messageContainer}>
        {showError ? (
          <View style={styles.errorContent}>
            <IconSymbol name="exclamationmark.circle.fill" size={24} color={noctalia.status.danger.icon} />
            <Text style={[styles.errorMessage, { color: noctalia.status.danger.text }]}>{message}</Text>
          </View>
        ) : (
          <View style={styles.statusContent}>
            <View style={styles.spinner}>
              <IconSymbol name="hourglass" size={20} color={noctalia.accent.base} />
            </View>
            <Text style={[styles.statusMessage, { color: noctalia.text.secondary }]}>{message}</Text>
          </View>
        )}
      </View>

      {/* Retry Button */}
      {showError && onRetry && error?.canRetry && (
        <Pressable
          style={[
            styles.retryButton,
            shadows.md,
            { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
          ]}
          onPress={onRetry}
        >
          <IconSymbol name="arrow.clockwise" size={20} color={noctalia.action.primaryText} />
          <Text style={[styles.retryButtonText, { color: noctalia.action.primaryText }]}>{t('analysis.retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 24,
    // backgroundColor: set dynamically
    borderRadius: 16,
    borderWidth: 1,
    // shadow: applied via theme shadows (inline)
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    // backgroundColor: set dynamically
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    // backgroundColor: set dynamically
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    minWidth: 40,
    textAlign: 'right',
  },
  messageContainer: {
    marginBottom: 8,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMessage: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorMessage: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // backgroundColor: set dynamically
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
    // shadow: applied via theme shadows.md
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
  },
});
