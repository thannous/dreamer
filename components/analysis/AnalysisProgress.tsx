import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurrealTheme, Fonts } from '@/constants/theme';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import type { ClassifiedError } from '@/lib/errors';

interface AnalysisProgressProps {
  step: AnalysisStep;
  progress: number; // 0-100
  message: string;
  error: ClassifiedError | null;
  onRetry?: () => void;
}

export function AnalysisProgress({ step, progress, message, error, onRetry }: AnalysisProgressProps) {
  const showError = step === AnalysisStep.ERROR && error;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      {!showError && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}

      {/* Status Message */}
      <View style={styles.messageContainer}>
        {showError ? (
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.errorMessage}>{message}</Text>
          </View>
        ) : (
          <View style={styles.statusContent}>
            <View style={styles.spinner}>
              <Ionicons name="hourglass-outline" size={20} color={SurrealTheme.accent} />
            </View>
            <Text style={styles.statusMessage}>{message}</Text>
          </View>
        )}
      </View>

      {/* Retry Button */}
      {showError && onRetry && error?.canRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
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
    backgroundColor: SurrealTheme.darkAccent,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    backgroundColor: SurrealTheme.shape,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: SurrealTheme.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: SurrealTheme.textLight,
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
    color: SurrealTheme.textLight,
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
    color: '#EF4444',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SurrealTheme.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
    shadowColor: SurrealTheme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
