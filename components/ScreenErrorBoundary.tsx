import { router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { reportStabilityError } from '@/lib/observe';
import { ErrorBoundary } from './ErrorBoundary';
import { TypeScale } from '@/constants/typeScale';

interface ScreenErrorFallbackProps {
  error: Error;
  resetError: () => void;
  /** Replaces the default reset-then-go-home; null hides the button. */
  onGoHome?: (() => void) | null;
}

/**
 * Screen-level error fallback with themed styling and navigation options
 */
function ScreenErrorFallback({ error, resetError, onGoHome }: ScreenErrorFallbackProps): React.ReactElement {
  const { colors, mode, shadows } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const handleGoHome =
    onGoHome === undefined
      ? () => {
          resetError();
          router.replace('/(tabs)');
        }
      : onGoHome;

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
      <View
        style={[
          styles.card,
          shadows.lg,
          { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        ]}
      >
        <Text style={[styles.emoji]}>😔</Text>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {t('error.screen_crashed', { defaultValue: 'Something went wrong' })}
        </Text>
        <Text style={[styles.message, { color: noctalia.text.secondary }]}>
          {t('error.screen_message', { 
            defaultValue: 'An unexpected error occurred on this screen.' 
          })}
        </Text>
        {__DEV__ && (
          <Text
            style={[
              styles.devError,
              {
                backgroundColor: noctalia.surface.soft,
                color: noctalia.accent.text,
              },
            ]}
          >
            {error.message}
          </Text>
        )}
        <View style={styles.buttonContainer}>
          <Pressable 
            onPress={resetError} 
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('error.try_again', { defaultValue: 'Try Again' })}
          >
            <Text style={[styles.buttonText, { color: noctalia.action.primaryText }]}>
              {t('error.try_again', { defaultValue: 'Try Again' })}
            </Text>
          </Pressable>
          {handleGoHome ? (
            <Pressable
              onPress={handleGoHome}
              style={[
                styles.button,
                styles.secondaryButton,
                { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('error.go_home', { defaultValue: 'Go Home' })}
            >
              <Text style={[styles.buttonText, { color: noctalia.text.primary }]}>
                {t('error.go_home', { defaultValue: 'Go Home' })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Fallback for Expo Router's per-screen error boundary (`unstable_screenErrorBoundary`):
 * a screen that throws shows this card while the navigator, and the tab bar, stay mounted.
 */
export function RouteScreenErrorFallback({ error, retry }: ErrorBoundaryProps): React.ReactElement {
  const pathname = usePathname();

  useEffect(() => {
    // The router's boundary catches the error before any global handler sees it.
    reportStabilityError(error);
  }, [error]);

  // Leaves without retrying: a retry would render the broken screen, and throw, again.
  // A broken tab keeps this card until the person comes back to it and tries again.
  const goHome = pathname === '/' ? null : () => router.replace('/(tabs)');

  return <ScreenErrorFallback error={error} resetError={() => void retry()} onGoHome={goHome} />;
}

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback component */
  fallback?: React.ComponentType<ScreenErrorFallbackProps>;
}

/**
 * Error boundary wrapper for individual screens.
 * Provides themed error UI and recovery options without crashing the entire app.
 * 
 * Usage:
 * ```tsx
 * export default function MyScreen() {
 *   return (
 *     <ScreenErrorBoundary>
 *       <MyScreenContent />
 *     </ScreenErrorBoundary>
 *   );
 * }
 * ```
 */
export function ScreenErrorBoundary({ children, fallback }: ScreenErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback ?? ScreenErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ThemeLayout.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 1,
    padding: ThemeLayout.spacing.xl,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: ThemeLayout.spacing.md,
  },
  title: {
    fontSize: TypeScale.h2.fontSize,
    fontFamily: Fonts.outfit.bold,
    textAlign: 'center',
    marginBottom: ThemeLayout.spacing.sm,
  },
  message: {
    fontSize: TypeScale.body.fontSize,
    fontFamily: Fonts.outfit.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: ThemeLayout.spacing.md,
  },
  devError: {
    fontSize: TypeScale.caption.fontSize,
    fontFamily: Fonts.outfit.regular,
    textAlign: 'center',
    marginBottom: ThemeLayout.spacing.lg,
    padding: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.sm,
    overflow: 'hidden',
  },
  buttonContainer: {
    width: '100%',
    gap: ThemeLayout.spacing.sm,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: ThemeLayout.borderRadius.md,
    alignItems: 'center',
  },
  primaryButton: {
    borderWidth: 1,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: TypeScale.body.fontSize,
    fontFamily: Fonts.outfit.bold,
  },
});

export default ScreenErrorBoundary;
