import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewInstance,
  type ViewStyle,
  View,
} from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getLegalLink } from '@/constants/legalLinks';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { TypeScale } from '@/constants/typeScale';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import { registerAiConsentPromptHandler, type AiConsentPromptHandler } from '@/lib/aiConsent';
import { TID } from '@/lib/testIDs';

const webTitleFocusResetStyle: TextStyle | null = process.env.EXPO_OS === 'web'
  ? ({
      outlineColor: 'transparent',
      outlineStyle: 'none',
      outlineWidth: 0,
    } as unknown as TextStyle)
  : null;

/**
 * Cute animated & fluffy Noctalia mascot: a chubby sleeping crescent moon nestled in
 * a soft cloud pillow, gently bobbing and breathing while its dream star twinkles.
 */
function NoctaliaDreamEmblem({
  isDark,
  accent,
  reducedMotion,
}: {
  isDark: boolean;
  accent: string;
  reducedMotion: boolean;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `noctalia-consent-glow-${rawId}`;
  const moonId = `noctalia-consent-moon-${rawId}`;
  const cloudBackId = `noctalia-consent-cloud-back-${rawId}`;
  const cloudFrontId = `noctalia-consent-cloud-front-${rawId}`;
  const blushColor = isDark ? '#F6A6B2' : '#E07A88';
  const starColor = isDark ? '#FFF9EF' : '#9A6332';
  const faceInk = isDark ? '#382D35' : '#4E383C';

  const haloMotion = useMemo<CSSStyle<ViewStyle>>(
    () =>
      reducedMotion
        ? {}
        : {
            animationName: {
              from: { opacity: 0.72, transform: [{ scale: 0.94 }] },
              to: { opacity: 1, transform: [{ scale: 1.06 }] },
            },
            animationDuration: 2800,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: EASE.inOut,
          },
    [reducedMotion]
  );

  const moonFloatMotion = useMemo<CSSStyle<ViewStyle>>(
    () =>
      reducedMotion
        ? {}
        : {
            animationName: {
              '0%': { transform: [{ translateY: 1.5 }, { rotate: '-2.5deg' }, { scale: 0.99 }] },
              '50%': { transform: [{ translateY: -3.5 }, { rotate: '2.5deg' }, { scale: 1.02 }] },
              '100%': { transform: [{ translateY: 1.5 }, { rotate: '-2.5deg' }, { scale: 0.99 }] },
            },
            animationDuration: 3600,
            animationIterationCount: 'infinite',
            animationTimingFunction: EASE.inOut,
          },
    [reducedMotion]
  );

  const cloudCradleMotion = useMemo<CSSStyle<ViewStyle>>(
    () =>
      reducedMotion
        ? {}
        : {
            animationName: {
              from: { transform: [{ translateY: 0 }, { scaleX: 0.98 }, { scaleY: 1.02 }] },
              to: { transform: [{ translateY: 1.8 }, { scaleX: 1.03 }, { scaleY: 0.97 }] },
            },
            animationDuration: 2400,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: EASE.inOut,
          },
    [reducedMotion]
  );

  const starTwinkleMotion = useMemo<CSSStyle<ViewStyle>>(
    () =>
      reducedMotion
        ? {}
        : {
            animationName: {
              from: { opacity: 0.65, transform: [{ scale: 0.88 }, { rotate: '-8deg' }] },
              to: { opacity: 1, transform: [{ scale: 1.12 }, { rotate: '8deg' }] },
            },
            animationDuration: 1900,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: EASE.inOut,
          },
    [reducedMotion]
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.emblemContainer}
    >
      {/* Layer 1: Breathing ambient halo + back cloud */}
      <Animated.View style={[StyleSheet.absoluteFill, haloMotion] as StyleProp<ViewStyle>}>
        <Svg width={96} height={92} viewBox="0 0 96 92" fill="none">
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="46%" r="48%">
              <Stop offset="0%" stopColor={accent} stopOpacity={isDark ? 0.42 : 0.28} />
              <Stop offset="62%" stopColor={accent} stopOpacity={isDark ? 0.14 : 0.08} />
              <Stop offset="100%" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={cloudBackId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={isDark ? '#353148' : '#FFFDF9'} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={isDark ? '#211E2E' : '#EFE2D0'} stopOpacity={0.85} />
            </LinearGradient>
          </Defs>
          <Circle cx={48} cy={43} r={42} fill={`url(#${glowId})`} />
          {/* Fluffy back cloud puffs */}
          <Circle cx={28} cy={59} r={11} fill={`url(#${cloudBackId})`} />
          <Circle cx={68} cy={58} r={11.5} fill={`url(#${cloudBackId})`} />
          <Circle cx={48} cy={55} r={13} fill={`url(#${cloudBackId})`} />
        </Svg>
      </Animated.View>

      {/* Layer 2: Floating chubby sleeping crescent moon + nightcap puff */}
      <Animated.View style={[StyleSheet.absoluteFill, moonFloatMotion] as StyleProp<ViewStyle>}>
        <Svg width={96} height={92} viewBox="0 0 96 92" fill="none">
          <Defs>
            <RadialGradient id={moonId} cx="32%" cy="28%" r="72%">
              <Stop offset="0%" stopColor="#FFFDF8" />
              <Stop offset="55%" stopColor={isDark ? '#F5E3C8' : '#EAD4B4'} />
              <Stop offset="100%" stopColor={isDark ? '#D9B382' : '#C89660'} />
            </RadialGradient>
          </Defs>

          {/* Plump, rounded crescent moon */}
          <Path
            d="M 52 16 C 32 15.5, 21 30, 24.5 48 C 28 65, 46 72, 64 62.5 C 66.5 61, 66 57.5, 63 57.2 C 50.5 56.5, 42.5 47.5, 43 35.5 C 43.4 26.8, 48.5 21.2, 54.5 19.2 C 57 18.4, 55.2 16.1, 52 16 Z"
            fill={`url(#${moonId})`}
            stroke={accent}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Fluffy little pom-pom on the top tip of the moon */}
          <Circle
            cx={55.5}
            cy={16.8}
            r={3.8}
            fill="#FFFDF9"
            stroke={accent}
            strokeOpacity={0.55}
            strokeWidth={0.9}
          />

          {/* Soft inner highlight on the moon's forehead */}
          <Path
            d="M 39 22.5 C 33 26.5, 29.5 33.5, 29.5 41"
            stroke="#FFFDF9"
            strokeWidth={2.2}
            strokeLinecap="round"
            opacity={0.65}
          />

          {/* Happy sleeping eye with tiny lash */}
          <Path
            d="M 31 38.5 Q 34.2 41.6 37.4 38.5"
            stroke={faceInk}
            strokeWidth={1.7}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 30.2 39.2 L 28.8 40.3"
            stroke={faceInk}
            strokeWidth={1.3}
            strokeLinecap="round"
          />

          {/* Rosy fluffy cheek */}
          <Ellipse cx={29.8} cy={43.2} rx={3.2} ry={2.1} fill={blushColor} opacity={0.68} />

          {/* Gentle sleepy smile */}
          <Path
            d="M 34.2 44.2 Q 36.4 46.2 38.8 44.3"
            stroke={faceInk}
            strokeWidth={1.45}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Layer 3: Twinkling dream star & sparkles */}
      <Animated.View style={[StyleSheet.absoluteFill, starTwinkleMotion] as StyleProp<ViewStyle>}>
        <Svg width={96} height={92} viewBox="0 0 96 92" fill="none">
          {/* Plush 4-pointed Noctalia star nestled in the moon's hollow */}
          <Path
            d="M 58 27 Q 60 35 68 37 Q 60 39 58 47 Q 56 39 48 37 Q 56 35 58 27 Z"
            fill={starColor}
            stroke={accent}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <Circle cx={58} cy={37} r={2.2} fill="#FFFDF9" opacity={0.9} />

          {/* Companion sparkles */}
          <Path
            d="M 70 20 Q 70.8 23.2 74 24 Q 70.8 24.8 70 28 Q 69.2 24.8 66 24 Q 69.2 23.2 70 20 Z"
            fill={accent}
            opacity={0.9}
          />
          <Circle cx={20} cy={27} r={1.6} fill={accent} opacity={0.75} />
          <Circle cx={74} cy={44} r={1.5} fill={starColor} opacity={0.75} />
          <Circle cx={24} cy={18} r={1.1} fill={starColor} opacity={0.55} />
        </Svg>
      </Animated.View>

      {/* Layer 4: Fluffy front cloud cushion */}
      <Animated.View style={[StyleSheet.absoluteFill, cloudCradleMotion] as StyleProp<ViewStyle>}>
        <Svg width={96} height={92} viewBox="0 0 96 92" fill="none">
          <Defs>
            <LinearGradient id={cloudFrontId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={isDark ? '#FFF9EF' : '#FFFFFF'} stopOpacity={isDark ? 0.94 : 0.98} />
              <Stop offset="100%" stopColor={isDark ? '#DECbb1' : '#F2E3CE'} stopOpacity={isDark ? 0.9 : 0.96} />
            </LinearGradient>
          </Defs>
          {/* Soft billowy cloud pillow */}
          <Path
            d="M 23 68 C 17.5 68, 13.5 64.2, 13.5 59.2 C 13.5 54.8, 16.8 51.2, 21.2 50.6 C 22.8 45.4, 27.8 41.8, 33.6 41.8 C 37.5 41.8, 41 43.5, 43.3 46.2 C 45.8 43.2, 49.6 41.4, 53.8 41.4 C 60.5 41.4, 66 46.2, 67.1 52.5 C 71.2 53.1, 74.2 56.5, 74.2 60.6 C 74.2 65.2, 70.4 68, 65.5 68 Z"
            fill={`url(#${cloudFrontId})`}
            stroke={accent}
            strokeOpacity={isDark ? 0.55 : 0.38}
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fluffy inner cloud creases */}
          <Path
            d="M 29 56.5 Q 34 59.5 39 56.2"
            stroke={accent}
            strokeOpacity={0.45}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 50 55.5 Q 55.5 58.5 60.5 55"
            stroke={accent}
            strokeOpacity={0.45}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

type AiConsentModalProps = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/** Folded by default; lives inside the Modal content so it closes again on every new prompt. */
function AiConsentDetails() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toggleDetails = useCallback(() => setDetailsOpen((open) => !open), []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        hitSlop={8}
        onPress={toggleDetails}
        style={({ pressed }) => [styles.privacyLinkButton, pressed && styles.pressed]}
        testID={TID.Button.AiConsentDetailsToggle}
      >
        <Text style={[styles.privacyLinkText, styles.detailsToggleText, { color: noctalia.accent.text }]}>
          {t(detailsOpen ? 'ai_consent.details_hide' : 'ai_consent.details_show')}
        </Text>
        <IconSymbol
          name={detailsOpen ? 'chevron.up' : 'chevron.down'}
          size={15}
          color={noctalia.accent.text}
        />
      </Pressable>

      {detailsOpen ? (
        <ScrollView
          nestedScrollEnabled
          style={styles.details}
          testID={TID.Component.AiConsentDetails}
        >
          <View style={styles.detailsItem}>
            <Text style={[styles.detailsTitle, { color: noctalia.text.primary }]}>
              {t('ai_consent.details_sent_title')}
            </Text>
            <Text style={[styles.detailsBody, { color: noctalia.text.secondary }]}>
              {t('ai_consent.details_sent_body')}
            </Text>
          </View>
          <View style={styles.detailsItem}>
            <Text style={[styles.detailsTitle, { color: noctalia.text.primary }]}>
              {t('ai_consent.details_when_title')}
            </Text>
            <Text style={[styles.detailsBody, { color: noctalia.text.secondary }]}>
              {t('ai_consent.details_when_body')}
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </>
  );
}

export function AiConsentModal({ visible, onAccept, onDecline }: AiConsentModalProps) {
  const { colors, mode, shadows } = useTheme();
  const { t, currentLang } = useTranslation();
  const insets = useSafeAreaInsets();
  const prefersReducedMotion = usePrefersReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const titleRef = useRef<ViewInstance | null>(null);
  const isDark = mode === 'dark';
  const decorativeAccent = isDark ? noctalia.accent.soft : noctalia.accent.strong;

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

  const handleOpenPrivacyPolicy = useCallback(() => {
    void Linking.openURL(getLegalLink('privacyPolicy', currentLang)).catch(() => undefined);
  }, [currentLang]);

  return (
    <Modal
      animationType={prefersReducedMotion ? 'none' : 'fade'}
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onDecline}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.overlay,
          {
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
            paddingTop: 16 + insets.top,
            paddingBottom: 16 + insets.bottom,
          },
        ]}
        testID={TID.Modal.AiConsent}
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
          accessibilityLabel={t('ai_consent.decline')}
          accessibilityRole="button"
          onPress={onDecline}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: noctalia.surface.raised,
              borderColor: isDark ? noctalia.accent.strong : noctalia.accent.soft,
            },
            shadows.xl,
          ]}
          testID={TID.Component.AiConsentCard}
        >
          <NoctaliaDreamEmblem
            isDark={isDark}
            accent={decorativeAccent}
            reducedMotion={prefersReducedMotion}
          />

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
            {t('ai_consent.title')}
          </Text>

          <Text style={[styles.message, { color: noctalia.text.secondary }]}>
            {t('ai_consent.message')}
          </Text>

          <AiConsentDetails />

          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={handleOpenPrivacyPolicy}
            style={({ pressed }) => [styles.privacyLinkButton, pressed && styles.pressed]}
            testID={TID.Button.AiConsentPrivacyPolicy}
          >
            <IconSymbol name="lock.shield" size={15} color={noctalia.accent.text} />
            <Text style={[styles.privacyLinkText, { color: noctalia.accent.text }]}>
              {t('settings.legal.privacyPolicy')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAccept}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: noctalia.action.primary,
                borderColor: noctalia.action.primaryBorder,
                opacity: pressed ? 0.86 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
            testID={TID.Button.AiConsentAccept}
          >
            <Text style={[styles.primaryButtonText, { color: noctalia.action.primaryText }]}>
              {t('ai_consent.accept')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDecline}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            testID={TID.Button.AiConsentDecline}
          >
            <Text style={[styles.secondaryText, { color: noctalia.text.tertiary }]}>
              {t('ai_consent.decline')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type Deferred = {
  promise: Promise<boolean>;
  resolve: (accepted: boolean) => void;
};

function createDeferred(): Deferred {
  let resolve: ((accepted: boolean) => void) | undefined;
  const promise = new Promise<boolean>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: (accepted: boolean) => resolve?.(accepted),
  };
}

export function AiConsentModalHost() {
  const [visible, setVisible] = useState(false);
  const deferredRef = useRef<Deferred | null>(null);

  const settle = useCallback((accepted: boolean) => {
    setVisible(false);
    const deferred = deferredRef.current;
    deferredRef.current = null;
    deferred?.resolve(accepted);
  }, []);

  const handleAccept = useCallback(() => {
    settle(true);
  }, [settle]);

  const handleDecline = useCallback(() => {
    settle(false);
  }, [settle]);

  const show = useCallback(async () => {
    setVisible(true);
    if (!deferredRef.current) {
      deferredRef.current = createDeferred();
    }
    return deferredRef.current.promise;
  }, []);

  useEffect(() => {
    const handler: AiConsentPromptHandler = { show };
    return registerAiConsentPromptHandler(handler);
  }, [show]);

  useEffect(() => {
    return () => {
      const deferred = deferredRef.current;
      deferredRef.current = null;
      deferred?.resolve(false);
    };
  }, []);

  return (
    <AiConsentModal
      visible={visible}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  emblemContainer: {
    width: 96,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: TypeScale.h2.fontSize,
    lineHeight: TypeScale.h2.lineHeight,
    textAlign: 'center',
  },
  message: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.body.fontSize,
    lineHeight: TypeScale.body.lineHeight,
    textAlign: 'center',
    marginTop: 10,
  },
  privacyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  privacyLinkText: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: TypeScale.bodySm.lineHeight,
    textDecorationLine: 'underline',
  },
  detailsToggleText: {
    textDecorationLine: 'none',
  },
  details: {
    width: '100%',
    maxHeight: 220,
    marginTop: 4,
  },
  detailsItem: {
    gap: 2,
    marginBottom: 12,
  },
  detailsTitle: {
    fontFamily: Fonts.outfit.bold,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: TypeScale.bodySm.lineHeight,
  },
  detailsBody: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: TypeScale.bodySm.lineHeight,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.outfit.bold,
    fontSize: TypeScale.body.fontSize,
    lineHeight: 21,
    textAlign: 'center',
  },
  secondaryButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: Fonts.outfit.bold,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.68,
  },
});
