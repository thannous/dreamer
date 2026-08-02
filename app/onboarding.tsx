import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { trackProductEvent } from '@/lib/analytics';
import type { OnboardingPath, OnboardingStep } from '@/lib/onboardingState';
import { markPerformance } from '@/lib/performanceTrace';
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
  InteractionManager,
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
  type TextStyle,
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

const INTRO_BACKGROUND_IMAGE = require('@/assets/images/onboarding-astral-background.webp');
const PATH_BACKGROUND_IMAGE = require('@/assets/images/onboarding-path-background.webp');
const PATH_BACKGROUND_ASPECT_RATIO = 853 / 510;

const webTitleFocusResetStyle: TextStyle | null = process.env.EXPO_OS === 'web'
  ? ({
      outlineColor: 'transparent',
      outlineStyle: 'none',
      outlineWidth: 0,
    } as unknown as TextStyle)
  : null;

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
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [analyticsPreferenceLoading, setAnalyticsPreferenceLoading] = useState(false);
  const [analyticsPreferenceError, setAnalyticsPreferenceError] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [pathPreloaded, setPathPreloaded] = useState(state.step === 'path');
  const [stepHeights, setStepHeights] = useState<Partial<Record<OnboardingStep, number>>>({});
  const introTitleRef = useRef<Text | null>(null);
  const pathTitleRef = useRef<Text | null>(null);
  const startedRef = useRef(false);
  const viewedStepsRef = useRef<Set<OnboardingStep>>(new Set());
  const focusedStepRef = useRef<OnboardingStep | null>(null);
  const isLeavingRef = useRef(false);
  const stepTransitionRef = useRef(false);
  const selectionVersionRef = useRef(0);

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
      backgroundSize: 'cover',
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
    if (Platform.OS === 'web') return;
    void Asset.loadAsync(PATH_BACKGROUND_IMAGE).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading || pathPreloaded || step === 'path' || isLeaving) return;
    const task = InteractionManager.runAfterInteractions(() => {
      // The screen can start leaving between scheduling and draining this task.
      // Mounting the path layer into a detaching screen makes Fabric insert a
      // subtree while `react-native-screens` re-parents the same surface.
      if (isLeavingRef.current) return;
      setPathPreloaded(true);
    });
    return () => task.cancel();
  }, [isLeaving, loading, pathPreloaded, step]);

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
    if (!viewedStepsRef.current.has(step)) {
      viewedStepsRef.current.add(step);
      void trackProductEvent('onboarding_step_viewed', { step });
    }
  }, [loading, step]);

  const handleTitleLayout = useCallback((renderedStep: OnboardingStep) => {
    if (loading || step !== renderedStep || focusedStepRef.current === renderedStep) return;
    markPerformance('onboarding.step_rendered', { step: renderedStep });
    focusedStepRef.current = renderedStep;
    if (process.env.EXPO_OS === 'web') {
      (renderedStep === 'intro' ? introTitleRef : pathTitleRef).current?.focus();
    } else {
      const node = findNodeHandle(
        (renderedStep === 'intro' ? introTitleRef : pathTitleRef).current
      );
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }
    AccessibilityInfo.announceForAccessibility(
      t('onboarding.progress', { current: renderedStep === 'intro' ? 1 : 2, total: 2 })
    );
    markPerformance('onboarding.accessibility_focus', { step: renderedStep });
  }, [loading, step, t]);

  useEffect(() => {
    if (
      Platform.OS !== 'android'
      || loading
      || focusedStepRef.current === null
      || focusedStepRef.current === step
    ) return;
    const frame = requestAnimationFrame(() => handleTitleLayout(step));
    return () => cancelAnimationFrame(frame);
  }, [handleTitleLayout, loading, step]);

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
    if (stepTransitionRef.current || isLeavingRef.current) return;
    markPerformance('onboarding.continue_pressed', { next_step: nextStep });
    stepTransitionRef.current = true;
    setIsStepTransitioning(true);
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
    } finally {
      stepTransitionRef.current = false;
      setIsStepTransitioning(false);
    }
  }, [transition]);

  const completePath = useCallback(async (path: OnboardingPath) => {
    if (isLeavingRef.current || stepTransitionRef.current) return;
    isLeavingRef.current = true;
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
      // Only the failure path restores the idle CTA. After a successful
      // navigation this screen is detaching, and re-mounting the CTA subtree in
      // the same commit races the native screen transition.
      isLeavingRef.current = false;
      setIsLeaving(false);
      setFailedAction({ type: 'complete', path });
    }
  }, [openRecording, transition]);

  const skip = useCallback(async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
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
      // See `completePath`: the idle CTA only comes back when we stay.
      isLeavingRef.current = false;
      setIsLeaving(false);
      setFailedAction({ type: 'skip' });
    }
  }, [step, transition]);

  const selectPath = useCallback((path: OnboardingPath) => {
    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    setSelectedPathOverride(path);
    setFailedAction(null);
    void transition({ type: 'SELECT_PATH', path })
      .then(() => {
        if (selectionVersionRef.current !== selectionVersion) return;
        void trackProductEvent('onboarding_choice_selected', {
          surface: 'app_onboarding',
          step: 'path',
          choice: path,
        });
      })
      .catch(() => {
        if (selectionVersionRef.current !== selectionVersion) return;
        setSelectedPathOverride(state.selectedPath);
        setFailedAction({ type: 'select', path });
      });
  }, [state.selectedPath, transition]);

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
  const handleStepLayout = useCallback((renderedStep: OnboardingStep, event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent?.layout?.height;
    if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;
    const nextHeight = Math.ceil(measuredHeight);
    setStepHeights((current) => current[renderedStep] === nextHeight
      ? current
      : { ...current, [renderedStep]: nextHeight });
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
  const layeredStepHeight = Math.max(stepHeights.intro ?? 0, stepHeights.path ?? 0) || undefined;

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
          <View style={styles.topBarLeading}>
            <Text
              accessibilityElementsHidden={step !== 'intro'}
              importantForAccessibility={step === 'intro' ? 'auto' : 'no-hide-descendants'}
              pointerEvents="none"
              style={[
                styles.brand,
                { color: noctalia.text.primary },
                step !== 'intro' && styles.inactiveControl,
              ]}
            >
              Noctalia
            </Text>
            <Pressable
              accessibilityElementsHidden={step !== 'path'}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              onPress={() => void runStepTransition('intro')}
              disabled={isStepTransitioning}
              importantForAccessibility={step === 'path' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={step === 'path' ? 'auto' : 'none'}
              style={[
                styles.iconButton,
                styles.topBarBack,
                step !== 'path' && styles.inactiveControl,
              ]}
              testID={TID.Button.OnboardingBack}
            >
              <IconSymbol name="chevron.left" size={22} color={noctalia.text.primary} />
            </Pressable>
          </View>
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

        <View
          style={Platform.OS === 'android'
            ? [
                styles.stepStage,
                {
                  height: layeredStepHeight,
                },
              ]
            : undefined}
        >
          <View
            accessibilityElementsHidden={step !== 'intro'}
            importantForAccessibility={step === 'intro' ? 'auto' : 'no-hide-descendants'}
            onLayout={Platform.OS === 'android'
              ? (event) => handleStepLayout('intro', event)
              : undefined}
            pointerEvents={step === 'intro' ? 'auto' : 'none'}
            style={[
              styles.intro,
              Platform.OS === 'android' && styles.stepLayer,
              step !== 'intro' && (
                Platform.OS === 'android' ? styles.inactiveStepLayer : styles.hiddenStep
              ),
            ]}
            testID={TID.Component.OnboardingIntro}
          >
            <View style={styles.heroImageWrap} accessible={false} importantForAccessibility="no-hide-descendants">
              {Platform.OS === 'web' ? (
                <View style={[styles.heroImage, introBackgroundWebStyle]} />
              ) : (
                <Image
                  accessible={false}
                  fadeDuration={0}
                  source={INTRO_BACKGROUND_IMAGE}
                  resizeMode="cover"
                  style={styles.heroImage}
                />
              )}
            </View>
            <Text
              ref={introTitleRef}
              {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
              accessible
              accessibilityRole="header"
              onLayout={() => handleTitleLayout('intro')}
              style={[styles.title, webTitleFocusResetStyle, { color: noctalia.text.primary }]}
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

          {pathPreloaded || step === 'path' ? (
            <View
              accessibilityElementsHidden={step !== 'path'}
              importantForAccessibility={step === 'path' ? 'auto' : 'no-hide-descendants'}
              onLayout={Platform.OS === 'android'
                ? (event) => handleStepLayout('path', event)
                : undefined}
              pointerEvents={step === 'path' ? 'auto' : 'none'}
              style={[
                styles.paths,
                Platform.OS === 'android' && styles.stepLayer,
                step !== 'path' && (
                  Platform.OS === 'android' ? styles.inactiveStepLayer : styles.hiddenStep
                ),
              ]}
              testID={TID.Component.OnboardingPath}
            >
            <View style={styles.pathHeroImageWrap} accessible={false} importantForAccessibility="no-hide-descendants">
              {Platform.OS === 'web' ? (
                <View style={[styles.pathHeroImage, pathBackgroundWebStyle]} />
              ) : (
                <Image
                  accessible={false}
                  fadeDuration={0}
                  source={PATH_BACKGROUND_IMAGE}
                  resizeMode="cover"
                  style={styles.pathHeroImage}
                />
              )}
            </View>
            <Text
              ref={pathTitleRef}
              {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
              accessible
              accessibilityRole="header"
              onLayout={() => handleTitleLayout('path')}
              style={[styles.pathHeading, webTitleFocusResetStyle, { color: noctalia.text.primary }]}
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
          ) : null}
        </View>

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
          accessibilityLabel={step === 'intro'
            ? t('onboarding.intro.cta')
            : t(`onboarding.path.${selectedDefinition.id}.cta`)}
          accessibilityRole="button"
          onPress={() => step === 'intro'
            ? void runStepTransition('path')
            : void completePath(selectedDefinition.id)}
          disabled={isLeaving || isStepTransitioning}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: noctalia.action.primary,
              borderColor: noctalia.action.primaryBorder,
              opacity: pressed || isLeaving || isStepTransitioning ? 0.78 : 1,
            },
          ]}
          testID={step === 'intro' ? TID.Button.OnboardingIntroNext : TID.Button.OnboardingPrimary}
        >
          {isLeaving ? (
            <ActivityIndicator color={noctalia.action.primaryText} />
          ) : (
            <View style={styles.primaryContent}>
              <View
                accessibilityElementsHidden={step !== 'intro'}
                importantForAccessibility={step === 'intro' ? 'auto' : 'no-hide-descendants'}
                style={[
                  styles.primaryContentLayer,
                  step !== 'intro' && styles.inactiveControl,
                ]}
              >
                <Text style={[styles.primaryText, { color: noctalia.action.primaryText }]}>
                  {t('onboarding.intro.cta')}
                </Text>
                <IconSymbol name="arrow.right" size={22} color={noctalia.action.primaryText} />
              </View>
              <View
                accessibilityElementsHidden={step !== 'path'}
                importantForAccessibility={step === 'path' ? 'auto' : 'no-hide-descendants'}
                style={[
                  styles.primaryContentLayer,
                  step !== 'path' && styles.inactiveControl,
                ]}
              >
                <Text style={[styles.primaryText, { color: noctalia.action.primaryText }]}>
                  {t(`onboarding.path.${selectedDefinition.id}.cta`)}
                </Text>
                <IconSymbol name="arrow.right" size={22} color={noctalia.action.primaryText} />
              </View>
            </View>
          )}
        </Pressable>
      </View>

      {showPrivacySheet ? <StandardBottomSheet
        visible
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
              disabled={!analyticsAvailable}
              value={analyticsAvailable && analyticsEnabled}
              onValueChange={(value) => void toggleAnalytics(value)}
              accessibilityLabel={t('onboarding.privacy.toggle_label')}
              accessibilityHint={t('onboarding.privacy.toggle_hint')}
            />
          )}
        </View>
      </StandardBottomSheet> : null}
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
  topBarLeading: { position: 'relative', minWidth: 80, height: 44, justifyContent: 'center' },
  topBarBack: { position: 'absolute', top: 0, left: 0 },
  brand: { fontFamily: Fonts.fraunces.regular, fontSize: 26, lineHeight: 32, minWidth: 80 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipButton: { minWidth: 72, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15 },
  intro: { alignItems: 'center', gap: 13 },
  heroImageWrap: {
    alignSelf: 'stretch',
    height: 280,
    marginHorizontal: -20,
    overflow: 'hidden',
  },
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
  stepStage: { position: 'relative', alignSelf: 'stretch' },
  stepLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  inactiveStepLayer: { opacity: 0 },
  inactiveControl: { opacity: 0 },
  paths: { gap: 12 },
  hiddenStep: { display: 'none' },
  pathHeroImageWrap: {
    alignSelf: 'stretch',
    aspectRatio: PATH_BACKGROUND_ASPECT_RATIO,
    marginHorizontal: -20,
    overflow: 'hidden',
  },
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
  // flex: 1 (not alignSelf: 'stretch') — in the row-direction button, stretch only
  // affects height; with absolute-only children the box collapses to width 0 and
  // Android drops the label entirely.
  primaryContent: { flex: 1, height: 24 },
  primaryContentLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  privacyAssurance: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  privacyAssuranceText: { flex: 1, fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 19 },
  privacyToggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  privacyToggleCopy: { flex: 1, gap: 3 },
  privacyToggleLabel: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 20 },
  privacyToggleHint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  privacyStatus: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 16 },
});
