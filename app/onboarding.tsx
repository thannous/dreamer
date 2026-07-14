import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { trackProductEvent } from '@/lib/analytics';
import type { OnboardingPath, OnboardingStep } from '@/lib/onboardingState';
import {
  getProductAnalyticsPreference,
  isProductAnalyticsAvailable,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';
import { TID } from '@/lib/testIDs';
import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  findNodeHandle,
  type ColorValue,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PathDefinition = {
  id: OnboardingPath;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
};

type FailedAction =
  | { type: 'start' }
  | { type: 'step'; step: OnboardingStep }
  | { type: 'select'; path: OnboardingPath }
  | { type: 'skip' }
  | { type: 'complete'; path: OnboardingPath };

const PATHS: PathDefinition[] = [
  { id: 'analyze', icon: 'moon.stars.fill' },
  { id: 'memory', icon: 'clock' },
  { id: 'dictionary', icon: 'book.closed.fill' },
];

const SIGNALS = [
  { id: 'capture', icon: 'pencil' as const },
  { id: 'decode', icon: 'eye.fill' as const },
  { id: 'profile', icon: 'sparkles' as const },
];

const INTRO_BACKGROUND_IMAGE = require('@/assets/images/onboarding-astral-background.png');
const PATH_BACKGROUND_IMAGE = require('@/assets/images/onboarding-path-background.png');

export default function OnboardingScreen() {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    state,
    loading,
    error: contextError,
    transition,
    continueForSession,
    reload,
  } = useOnboarding();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [selectedPathOverride, setSelectedPathOverride] = useState<OnboardingPath | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [analyticsPreferenceLoading, setAnalyticsPreferenceLoading] = useState(false);
  const [analyticsPreferenceError, setAnalyticsPreferenceError] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const titleRef = useRef<Text | null>(null);
  const startedRef = useRef(false);
  const viewedStepsRef = useRef<Set<OnboardingStep>>(new Set());

  const step: OnboardingStep = state.step === 'path' ? 'path' : 'intro';
  const titleAccent = noctalia.accent.strong;
  const background = noctalia.screen.background;
  const introUri = Asset.fromModule(INTRO_BACKGROUND_IMAGE).uri;
  const pathUri = Asset.fromModule(PATH_BACKGROUND_IMAGE).uri;
  const introBackgroundWebStyle = useMemo(
    () => ({
      backgroundImage: `url("${introUri}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain',
    }) as unknown as ViewStyle,
    [introUri]
  );
  const pathBackgroundWebStyle = useMemo(
    () => ({
      backgroundImage: `url("${pathUri}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }) as unknown as ViewStyle,
    [pathUri]
  );

  useEffect(() => {
    if (loading || startedRef.current || state.status !== 'not_started') return;
    startedRef.current = true;
    void transition({ type: 'START' })
      .then(() => trackProductEvent('onboarding_started', { experience_version: 2 }))
      .catch(() => {
        startedRef.current = false;
        setFailedAction({ type: 'start' });
      });
  }, [loading, state.status, transition]);

  useEffect(() => {
    if (loading) return;
    const timeout = setTimeout(() => {
      if (process.env.EXPO_OS === 'web') {
        titleRef.current?.focus();
      } else {
        const node = findNodeHandle(titleRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
      AccessibilityInfo.announceForAccessibility(
        t('onboarding.progress', { current: step === 'intro' ? 1 : 2, total: 2 })
      );
    }, 120);

    if (!viewedStepsRef.current.has(step)) {
      viewedStepsRef.current.add(step);
      void trackProductEvent('onboarding_step_viewed', { step });
    }
    return () => clearTimeout(timeout);
  }, [loading, step, t]);

  const openRecording = useCallback((nextState: typeof state, path: 'analyze' | 'memory') => {
    const pending = nextState.pendingRecordingIntent;
    if (!pending) {
      router.replace('/recording');
      return;
    }
    router.replace({
      pathname: '/recording',
      params: {
        entryId: pending.entryId,
        intent: pending.intent,
        source: pending.source,
        postSave: path === 'analyze' ? 'analyze' : 'journal',
      },
    });
  }, []);

  const runStepTransition = useCallback(async (nextStep: OnboardingStep) => {
    setFailedAction(null);
    try {
      await transition({ type: 'GO_TO_STEP', step: nextStep });
      void trackProductEvent('onboarding_choice_selected', {
        surface: 'app_onboarding',
        step: 'intro',
        choice: 'continue',
      });
    } catch {
      setFailedAction({ type: 'step', step: nextStep });
    }
  }, [transition]);

  const completePath = useCallback(async (path: OnboardingPath) => {
    if (isLeaving) return;
    setIsLeaving(true);
    setFailedAction(null);
    try {
      const next = await transition({ type: 'COMPLETE', path });
      void trackProductEvent('onboarding_completed', {
        reason: path,
        experience_version: 2,
      });
      if (path === 'dictionary') {
        router.replace({ pathname: '/symbol-dictionary', params: { source: 'onboarding' } });
      } else {
        openRecording(next, path);
      }
    } catch {
      setFailedAction({ type: 'complete', path });
    } finally {
      setIsLeaving(false);
    }
  }, [isLeaving, openRecording, transition]);

  const skip = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    setFailedAction(null);
    try {
      await transition({ type: 'SKIP' });
      void trackProductEvent('onboarding_choice_selected', {
        surface: 'app_onboarding',
        step,
        choice: 'skip',
      });
      void trackProductEvent('onboarding_completed', { reason: 'skip', experience_version: 2 });
      router.replace('/recording');
    } catch {
      setFailedAction({ type: 'skip' });
    } finally {
      setIsLeaving(false);
    }
  }, [isLeaving, step, transition]);

  const selectPath = useCallback((path: OnboardingPath) => {
    setSelectedPathOverride(path);
    setFailedAction(null);
    void trackProductEvent('onboarding_choice_selected', {
      surface: 'app_onboarding',
      step: 'path',
      choice: path,
    });
    void transition({ type: 'SELECT_PATH', path }).catch(() => {
      setFailedAction({ type: 'select', path });
    });
  }, [transition]);

  const retry = useCallback(async () => {
    const action = failedAction;
    if (!action) {
      await reload().catch(() => undefined);
      return;
    }
    if (action.type === 'start') {
      startedRef.current = false;
      await reload().catch(() => undefined);
      return;
    }
    if (action.type === 'step') {
      await runStepTransition(action.step);
      return;
    }
    if (action.type === 'select') {
      setFailedAction(null);
      await transition({ type: 'SELECT_PATH', path: action.path }).catch(() => {
        setFailedAction(action);
      });
      return;
    }
    if (action.type === 'skip') {
      await skip();
      return;
    }
    await completePath(action.path);
  }, [completePath, failedAction, reload, runStepTransition, skip, transition]);

  const continueWithoutSaving = useCallback(() => {
    const action = failedAction;
    if (!action || (action.type !== 'skip' && action.type !== 'complete')) return;
    const reason = action.type === 'skip' ? 'skip' : action.path;
    continueForSession(reason);
    setFailedAction(null);
    void trackProductEvent('onboarding_completed', { reason, experience_version: 2 });
    if (action.type === 'skip') {
      router.replace('/recording');
      return;
    }
    if (action.path === 'dictionary') {
      router.replace({ pathname: '/symbol-dictionary', params: { source: 'onboarding' } });
      return;
    }
    router.replace({
      pathname: '/recording',
      params: {
        entryId: `session-${Date.now().toString(36)}`,
        intent: action.path === 'memory' ? 'remembered' : 'fresh',
        source: 'onboarding',
        postSave: action.path === 'memory' ? 'journal' : 'analyze',
      },
    });
  }, [continueForSession, failedAction]);

  const openPrivacy = useCallback(() => {
    setShowPrivacySheet(true);
    setAnalyticsPreferenceError(false);
    setAnalyticsPreferenceLoading(true);
    void getProductAnalyticsPreference()
      .then((preference) => setAnalyticsEnabled(preference === 'enabled'))
      .catch(() => setAnalyticsPreferenceError(true))
      .finally(() => setAnalyticsPreferenceLoading(false));
  }, []);

  const toggleAnalytics = useCallback(async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    setAnalyticsPreferenceLoading(true);
    setAnalyticsPreferenceError(false);
    try {
      await setProductAnalyticsEnabled(enabled);
    } catch {
      setAnalyticsEnabled((current) => !current);
      setAnalyticsPreferenceError(true);
    } finally {
      setAnalyticsPreferenceLoading(false);
    }
  }, []);
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setFooterHeight((current) => current === nextHeight ? current : nextHeight);
  }, []);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: background }]} testID={TID.Screen.Onboarding}>
        <ActivityIndicator color={noctalia.accent.base} />
      </View>
    );
  }

  const visibleError = Boolean(contextError || failedAction);
  const canContinueForSession = failedAction?.type === 'skip' || failedAction?.type === 'complete';
  const selectedPath = selectedPathOverride ?? state.selectedPath ?? 'analyze';
  const selectedDefinition = PATHS.find((path) => path.id === selectedPath) ?? PATHS[0];
  const analyticsAvailable = isProductAnalyticsAvailable();

  return (
    <View style={[styles.screen, { backgroundColor: background }]} testID={TID.Screen.Onboarding}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 12, 28),
            paddingBottom: footerHeight,
          },
        ]}
      >
        <View style={styles.topBar}>
          {step === 'path' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              onPress={() => void runStepTransition('intro')}
              style={styles.iconButton}
              testID={TID.Button.OnboardingBack}
            >
              <IconSymbol name="chevron.left" size={22} color={noctalia.text.primary} />
            </Pressable>
          ) : (
            <Text style={[styles.brand, { color: noctalia.text.primary }]}>Noctalia</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void skip()}
            disabled={isLeaving}
            style={styles.skipButton}
            testID={TID.Button.OnboardingSkip}
          >
            <Text style={[styles.skipText, { color: titleAccent }]}>{t('onboarding.skip')}</Text>
          </Pressable>
        </View>

        {step === 'intro' ? (
          <View style={styles.intro} testID={TID.Component.OnboardingIntro}>
            <View style={styles.heroImageWrap} accessible={false} importantForAccessibility="no-hide-descendants">
              {Platform.OS === 'web' ? (
                <View style={[styles.heroImage, introBackgroundWebStyle]} />
              ) : (
                <Image
                  accessible={false}
                  source={INTRO_BACKGROUND_IMAGE}
                  resizeMode="contain"
                  style={styles.heroImage}
                />
              )}
            </View>
            <Text
              ref={titleRef}
              {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
              accessible
              accessibilityRole="header"
              style={[styles.title, { color: noctalia.text.primary }]}
            >
              {t('onboarding.intro.title_lead')}{' '}
              <Text style={{ color: titleAccent }}>{t('onboarding.intro.title_accent')}</Text>
            </Text>
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
              {t('onboarding.intro.subtitle')}
            </Text>
            <View style={styles.signalList} testID={TID.Component.OnboardingIntroSignals}>
              {SIGNALS.map((signal) => (
                <View key={signal.id} style={styles.signalRow}>
                  <View style={[styles.signalIcon, { backgroundColor: noctalia.surface.soft }]}>
                    <IconSymbol name={signal.icon} size={21} color={titleAccent as ColorValue} />
                  </View>
                  <View style={styles.signalCopy}>
                    <Text style={[styles.signalTitle, { color: noctalia.text.primary }]}>
                      {t(`onboarding.intro.signal.${signal.id}.title`)}
                    </Text>
                    <Text style={[styles.signalBody, { color: noctalia.text.secondary }]}>
                      {t(`onboarding.intro.signal.${signal.id}.body`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openPrivacy}
              style={styles.privacyLink}
              testID={TID.Button.OnboardingPrivacy}
            >
              <Text style={[styles.privacyLinkText, { color: titleAccent }]}>
                {t('onboarding.privacy.link')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.paths}>
            <View style={styles.pathHeroImageWrap} accessible={false} importantForAccessibility="no-hide-descendants">
              {Platform.OS === 'web' ? (
                <View style={[styles.pathHeroImage, pathBackgroundWebStyle]} />
              ) : (
                <Image
                  accessible={false}
                  source={PATH_BACKGROUND_IMAGE}
                  resizeMode="cover"
                  style={styles.pathHeroImage}
                />
              )}
            </View>
            <Text
              ref={titleRef}
              {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
              accessible
              accessibilityRole="header"
              style={[styles.pathHeading, { color: noctalia.text.primary }]}
            >
              {t('onboarding.path.title_lead')}{' '}
              <Text style={{ color: titleAccent }}>{t('onboarding.path.title_accent')}</Text>
            </Text>
            <Text style={[styles.pathSubtitle, { color: noctalia.text.secondary }]}>
              {t('onboarding.subtitle')}
            </Text>
            <View
              style={[
                styles.pathCard,
                { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.borderStrong },
              ]}
            >
              {PATHS.map((path, index) => {
                const selected = path.id === selectedPath;
                return (
                  <Pressable
                    key={path.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => selectPath(path.id)}
                    style={[
                      styles.pathRow,
                      index < PATHS.length - 1 && {
                        borderBottomColor: noctalia.surface.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                    testID={TID.Button.OnboardingPath(path.id)}
                  >
                    <View style={[styles.pathIcon, { backgroundColor: noctalia.surface.soft }]}>
                      <IconSymbol name={path.icon} size={25} color={titleAccent as ColorValue} />
                    </View>
                    <View style={styles.pathCopy}>
                      <Text style={[styles.pathTitle, { color: noctalia.text.primary }]}>
                        {t(`onboarding.path.${path.id}.title`)}
                      </Text>
                      <Text style={[styles.pathBody, { color: noctalia.text.secondary }]}>
                        {t(`onboarding.path.${path.id}.body`)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        {
                          backgroundColor: selected ? titleAccent : 'transparent',
                          borderColor: selected ? titleAccent : noctalia.text.tertiary,
                        },
                      ]}
                    >
                      {selected ? <IconSymbol name="checkmark" size={13} color={noctalia.text.onAccent} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {visibleError ? (
          <View
            accessibilityLiveRegion="assertive"
            style={[
              styles.errorCard,
              { backgroundColor: noctalia.status.danger.background, borderColor: noctalia.status.danger.border },
            ]}
            testID={TID.Component.OnboardingError}
          >
            <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
              {t('onboarding.persistence_error')}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void retry()}
                style={[styles.errorButton, { borderColor: noctalia.status.danger.border }]}
                testID={TID.Button.OnboardingRetry}
              >
                <Text style={[styles.errorButtonText, { color: noctalia.status.danger.text }]}>
                  {t('onboarding.retry')}
                </Text>
              </Pressable>
              {canContinueForSession ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={continueWithoutSaving}
                  style={styles.errorButton}
                  testID={TID.Button.OnboardingContinueSession}
                >
                  <Text style={[styles.errorButtonText, { color: noctalia.status.danger.text }]}>
                    {t('onboarding.continue_session')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        onLayout={handleFooterLayout}
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + 10, 18),
            backgroundColor: background,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => step === 'intro'
            ? void runStepTransition('path')
            : void completePath(selectedDefinition.id)}
          disabled={isLeaving}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: noctalia.action.primary,
              borderColor: noctalia.action.primaryBorder,
              opacity: pressed || isLeaving ? 0.78 : 1,
            },
          ]}
          testID={step === 'intro' ? TID.Button.OnboardingIntroNext : TID.Button.OnboardingPrimary}
        >
          {isLeaving ? (
            <ActivityIndicator color={noctalia.action.primaryText} />
          ) : (
            <>
              <Text style={[styles.primaryText, { color: noctalia.action.primaryText }]}>
                {step === 'intro'
                  ? t('onboarding.intro.cta')
                  : t(`onboarding.path.${selectedDefinition.id}.cta`)}
              </Text>
              <IconSymbol name="arrow.right" size={22} color={noctalia.action.primaryText} />
            </>
          )}
        </Pressable>
      </View>

      <StandardBottomSheet
        visible={showPrivacySheet}
        onClose={() => setShowPrivacySheet(false)}
        title={t('onboarding.privacy.title')}
        subtitle={t('onboarding.privacy.body')}
        testID={TID.Sheet.OnboardingPrivacy}
        actions={{
          primaryLabel: t('common.done'),
          onPrimary: () => setShowPrivacySheet(false),
        }}
      >
        <View
          style={[
            styles.privacyAssurance,
            { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
          ]}
        >
          <IconSymbol name="lock.fill" size={19} color={titleAccent} />
          <Text style={[styles.privacyAssuranceText, { color: noctalia.text.secondary }]}>
            {t('onboarding.privacy.no_content')}
          </Text>
        </View>
        <View style={styles.privacyToggleRow}>
          <View style={styles.privacyToggleCopy}>
            <Text style={[styles.privacyToggleLabel, { color: noctalia.text.primary }]}>
              {t('onboarding.privacy.toggle_label')}
            </Text>
            <Text style={[styles.privacyToggleHint, { color: noctalia.text.secondary }]}>
              {t('onboarding.privacy.toggle_hint')}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.privacyStatus, { color: analyticsPreferenceError ? noctalia.status.danger.text : titleAccent }]}
            >
              {analyticsPreferenceError
                ? t('onboarding.privacy.error')
                : !analyticsAvailable
                  ? t('analytics.privacy.unavailable')
                  : t(analyticsEnabled ? 'onboarding.privacy.enabled' : 'onboarding.privacy.disabled')}
            </Text>
          </View>
          {analyticsPreferenceLoading ? (
            <ActivityIndicator color={titleAccent} />
          ) : (
            <Switch
              value={analyticsEnabled}
              onValueChange={(value) => void toggleAnalytics(value)}
              accessibilityLabel={t('onboarding.privacy.toggle_label')}
              accessibilityHint={t('onboarding.privacy.toggle_hint')}
            />
          )}
        </View>
      </StandardBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 20, gap: 18 },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brand: { fontFamily: Fonts.fraunces.regular, fontSize: 26, lineHeight: 32, minWidth: 80 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipButton: { minWidth: 72, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15 },
  intro: { alignItems: 'center', gap: 13 },
  heroImageWrap: { height: 245, width: '100%', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  title: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 520,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  signalList: { width: '100%', maxWidth: 520, gap: 8, paddingTop: 4 },
  signalRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  signalIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  signalCopy: { flex: 1, gap: 1 },
  signalTitle: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 20 },
  signalBody: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  privacyLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  privacyLinkText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 13, textDecorationLine: 'underline' },
  paths: { gap: 12 },
  pathHeroImageWrap: { height: 168, marginHorizontal: -20, overflow: 'hidden' },
  pathHeroImage: { width: '100%', height: '100%' },
  pathHeading: { fontFamily: Fonts.fraunces.regular, fontSize: 34, lineHeight: 40, textAlign: 'center' },
  pathSubtitle: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pathCard: { borderWidth: 1, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  pathRow: { minHeight: 94, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 13 },
  pathIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pathCopy: { flex: 1, gap: 4 },
  pathTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 19, lineHeight: 24 },
  pathBody: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  errorCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  errorText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  errorButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingHorizontal: 12 },
  errorButtonText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
  primaryButton: { minHeight: 60, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  privacyAssurance: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  privacyAssuranceText: { flex: 1, fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 19 },
  privacyToggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  privacyToggleCopy: { flex: 1, gap: 3 },
  privacyToggleLabel: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 20 },
  privacyToggleHint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  privacyStatus: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 16 },
});
