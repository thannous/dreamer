import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import { isOnboardingTerminal } from '@/lib/onboardingState';
import { TID } from '@/lib/testIDs';
import {
  getLastSeenReleaseNotesVersion,
  saveLastSeenReleaseNotesVersion,
} from '@/services/storageService';

export const RELEASE_NOTES_VERSION = '3.0.0';

const webTitleFocusResetStyle: TextStyle | null = process.env.EXPO_OS === 'web'
  ? ({
      outlineColor: 'transparent',
      outlineStyle: 'none',
      outlineWidth: 0,
    } as unknown as TextStyle)
  : null;

type WhatsNewModalProps = {
  visible: boolean;
  onClose: () => void;
  onPrimary: () => void;
};

type Feature = {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  title: string;
  body: string;
};

export function WhatsNewModal({ visible, onClose, onPrimary }: WhatsNewModalProps) {
  const { colors, mode, shadows } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const prefersReducedMotion = usePrefersReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const titleRef = useRef<Text | null>(null);
  const isDark = mode === 'dark';
  const decorativeAccent = isDark ? noctalia.accent.soft : noctalia.accent.strong;
  const maxCardHeight = Math.max(300, height - insets.top - insets.bottom - 32);

  const features = useMemo<Feature[]>(
    () => [
      {
        icon: 'sparkles',
        title: t('release_notes.analysis.title'),
        body: t('release_notes.analysis.body'),
      },
      {
        icon: 'book.closed.fill',
        title: t('release_notes.guides.title'),
        body: t('release_notes.guides.body'),
      },
      {
        icon: 'mic',
        title: t('release_notes.capture.title'),
        body: t('release_notes.capture.body'),
      },
      {
        icon: 'slider.horizontal.3',
        title: t('release_notes.settings.title'),
        body: t('release_notes.settings.body'),
      },
    ],
    [t]
  );

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      if (Platform.OS === 'web') {
        titleRef.current?.focus();
        return;
      }

      const titleNode = findNodeHandle(titleRef.current);
      if (titleNode) AccessibilityInfo.setAccessibilityFocus(titleNode);
    }, 180);

    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      animationType={prefersReducedMotion ? 'none' : 'fade'}
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={styles.overlay}
        testID={TID.Modal.WhatsNew}
      >
        <BlurView
          intensity={isDark ? 34 : 18}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(3, 4, 13, 0.78)'
                : 'rgba(42, 40, 56, 0.28)',
            },
          ]}
        />
        <Pressable
          accessible={false}
          accessibilityLabel={t('release_notes.close')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(13, 11, 28, 0.98)' : 'rgba(255, 253, 248, 0.99)',
              borderColor: isDark ? noctalia.accent.strong : noctalia.accent.soft,
              maxHeight: maxCardHeight,
            },
            shadows.xl,
          ]}
          testID={TID.Component.WhatsNewCard}
        >
          <Pressable
            accessibilityLabel={t('release_notes.close')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: noctalia.surface.soft,
                borderColor: noctalia.surface.borderStrong,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
            testID={TID.Button.WhatsNewClose}
          >
            <IconSymbol name="xmark" size={21} color={noctalia.text.secondary} />
          </Pressable>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: noctalia.surface.soft,
                  borderColor: noctalia.accent.base,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: decorativeAccent }]}>
                {t('release_notes.badge', { version: RELEASE_NOTES_VERSION })}
              </Text>
            </View>

            <Text
              ref={titleRef}
              {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : {})}
              accessibilityRole="header"
              style={[
                styles.title,
                { color: noctalia.text.primary },
                webTitleFocusResetStyle,
              ]}
            >
              {t('release_notes.title')}
            </Text>
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
              {t('release_notes.subtitle')}
            </Text>

            <View style={styles.features}>
              {features.map((feature, index) => (
                <View
                  key={feature.title}
                  style={[
                    styles.feature,
                    index > 0 && {
                      borderTopColor: noctalia.surface.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.featureIcon,
                      {
                        backgroundColor: noctalia.surface.soft,
                        borderColor: noctalia.accent.base,
                      },
                    ]}
                  >
                    <IconSymbol name={feature.icon} size={22} color={decorativeAccent} />
                  </View>
                  <View style={styles.featureCopy}>
                    <Text style={[styles.featureTitle, { color: noctalia.text.primary }]}>
                      {feature.title}
                    </Text>
                    <Text style={[styles.featureBody, { color: noctalia.text.secondary }]}>
                      {feature.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: noctalia.action.primary,
                  borderColor: noctalia.action.primaryBorder,
                  opacity: pressed ? 0.86 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
              testID={TID.Button.WhatsNewPrimary}
            >
              <Text style={[styles.primaryButtonText, { color: noctalia.action.primaryText }]}>
                {t('release_notes.primary')}
              </Text>
              <IconSymbol name="arrow.right" size={19} color={noctalia.action.primaryText} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
              testID={TID.Button.WhatsNewLater}
            >
              <Text style={[styles.laterText, { color: noctalia.text.tertiary }]}>
                {t('release_notes.later')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function WhatsNewModalHost({ ready }: { ready: boolean }) {
  const { state, loading } = useOnboarding();
  const [visible, setVisible] = useState(false);
  const eligible = ready && !loading && isOnboardingTerminal(state);

  useEffect(() => {
    if (!eligible) return;

    let active = true;
    void getLastSeenReleaseNotesVersion().then((lastSeenVersion) => {
      if (active && lastSeenVersion !== RELEASE_NOTES_VERSION) {
        setVisible(true);
      }
    });

    return () => {
      active = false;
    };
  }, [eligible]);

  const persistDismissal = useCallback(() => {
    setVisible(false);
    void saveLastSeenReleaseNotesVersion(RELEASE_NOTES_VERSION).catch((error) => {
      if (__DEV__) {
        console.warn('[WhatsNewModal] Unable to persist dismissal', error);
      }
    });
  }, []);

  const handlePrimary = useCallback(() => {
    persistDismissal();
    router.push('/dream-guides');
  }, [persistDismissal]);

  return (
    <WhatsNewModal
      visible={visible}
      onClose={persistDismissal}
      onPrimary={handlePrimary}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 30,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 22,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'center',
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ThemeLayout.spacing.md,
  },
  badgeText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  features: {
    marginTop: 20,
  },
  feature: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  featureBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'center',
  },
  laterButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.68,
  },
});
