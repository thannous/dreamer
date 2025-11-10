import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import type { ClassifiedError } from '@/lib/errors';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';

interface AnalysisProgressProps {
  step: AnalysisStep;
  progress: number; // 0-100
  message: string;
  error: ClassifiedError | null;
  onRetry?: () => void;
}

export function AnalysisProgress({ step, progress, message, error, onRetry }: AnalysisProgressProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();
  const showError = step === AnalysisStep.ERROR && error;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Progress Bar */}
      {!showError && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: colors.backgroundDark }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.accent },
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textPrimary }]}>{Math.round(progress)}%</Text>
        </View>
      )}

      {/* Status Message */}
      <View style={styles.messageContainer}>
        {showError ? (
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={[styles.errorMessage, { color: colors.textPrimary }]}>{message}</Text>
          </View>
        ) : (
          <View style={styles.statusContent}>
            <View style={styles.spinner}>
              <Ionicons name="hourglass-outline" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>{message}</Text>
          </View>
        )}
      </View>

      {/* Retry Button */}
      {showError && onRetry && error?.canRetry && (
        <Pressable style={[styles.retryButton, shadows.md, { backgroundColor: colors.accent }]} onPress={onRetry}>
          <Ionicons name="refresh" size={20} color={colors.textPrimary} />
          <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('analysis.retry')}</Text>
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
    letterSpacing: 0.3,
  },
});
