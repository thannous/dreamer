import type { ViewInstance } from 'react-native';
import { scheduleIdleTask } from '@/lib/scheduleIdleTask';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE } from '@/components/motion/motion';
import type { OnboardingFeature } from '@/components/onboarding/OnboardingFeatureSheet';
import { LoopConstellation, type LoopNode } from '@/components/onboarding/story/LoopConstellation';
import { NightSky } from '@/components/onboarding/story/NightSky';
import { STORY, TRAVEL, reducedDelay } from '@/components/onboarding/story/storyMotion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { DarkTheme } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getPaywallTrigger, trackProductEvent } from '@/lib/analytics';
import { isOnboardingFeatureSheetsEnabled } from '@/lib/env';
import { peekReturnToPaywallTrigger } from '@/lib/navigationIntents';
import { getAuthReturnSnapshot } from '@/lib/authReturnIntent';
import { buildPaywallHref } from '@/lib/paywallRoute';
import type { OnboardingPath, OnboardingStep } from '@/lib/onboardingState';
import { markPerformance } from '@/lib/performanceTrace';
import {
  getProductAnalyticsPreference,
  isProductAnalyticsAvailable,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';
import { TID } from '@/lib/testIDs';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
  type ColorValue,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

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

// The intro tells the product loop — tell it, notice, connect — rather than listing
// features. Each beat keeps the id of the feature preview it opens when previews are on.
const SIGNALS = [
  { id: 'capture', copy: 'capture', icon: 'quote.opening' as const },
  { id: 'connect', copy: 'decode', icon: 'sparkles' as const },
  { id: 'explore', copy: 'profile', icon: 'arrow.triangle.2.circlepath' as const },
] satisfies { id: OnboardingFeature; copy: string; icon: React.ComponentProps<typeof IconSymbol>['name'] }[];

// Keep the disabled previews from initializing their motion/gesture modules.
const OnboardingFeatureSheet = React.lazy(() => import('@/components/onboarding/OnboardingFeatureSheet')
  .then((module) => ({ default: module.OnboardingFeatureSheet })));
// Fetched as soon as the stories open, so the door is ready the moment the reader steps through.
const loadDoorPassage = () => import('@/components/onboarding/story/DoorPassage');
const DoorPassage = React.lazy(() => loadDoorPassage().then((module) => ({ default: module.DoorPassage })));

const BACKGROUND_IMAGE = require('@/assets/images/onboarding-reverie-background.webp');
// The immersive artwork always needs its nocturnal contrast, independently of
// the user's app theme. The privacy sheet retains the app's own palette.
const ONBOARDING_TOKENS = getNoctaliaDesignTokens(DarkTheme, 'dark');

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
  const featureSheetsEnabled = isOnboardingFeatureSheetsEnabled();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const {
    state,
    loading,
    error: contextError,
    transition,
    continueForSession,
    reload,
  } = useOnboarding();
  const sheetTokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const noctalia = ONBOARDING_TOKENS;
  // Replayed from Settings: the steps stay on this screen and nothing is saved,
  // so a finished onboarding is never reopened or given a new capture intent.
  const isReplay = useLocalSearchParams<{ replay?: string }>().replay === '1';
  const [replayStep, setReplayStep] = useState<OnboardingStep>('intro');
  const { height: viewportHeight, fontScale } = useWindowDimensions();
  const [selectedPathOverride, setSelectedPathOverride] = useState<OnboardingPath | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [activeFeature, setActiveFeature] = useState<OnboardingFeature | null>(null);
  // "Commencer" tells the three stories in order once, then moves on to the path.
  const guidedTourSeenRef = useRef(false);
  // The stories end by walking through the blue door into the path step.
  const [doorPassage, setDoorPassage] = useState(false);
  const featureTriggers = useRef<Partial<Record<OnboardingFeature, ViewInstance | null>>>({});
  const featureFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setAnalyticsEnabled] = useState(false);
  const [analyticsPreferenceLoading, setAnalyticsPreferenceLoading] = useState(false);
  const [analyticsPreferenceError, setAnalyticsPreferenceError] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [pathPreloaded, setPathPreloaded] = useState(state.step === 'path');
  const [stepHeights, setStepHeights] = useState<Partial<Record<OnboardingStep, number>>>({});
  const introTitleRef = useRef<ViewInstance | null>(null);
  const pathTitleRef = useRef<ViewInstance | null>(null);
  const startedRef = useRef(false);
  const viewedStepsRef = useRef<Set<OnboardingStep>>(new Set());
  const focusedStepRef = useRef<OnboardingStep | null>(null);
  const isLeavingRef = useRef(false);
  const stepTransitionRef = useRef(false);
  const selectionVersionRef = useRef(0);

  useEffect(() => () => {
    if (featureFocusTimer.current) clearTimeout(featureFocusTimer.current);
  }, []);

  useEffect(() => {
    if (activeFeature) void loadDoorPassage();
  }, [activeFeature]);


  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
    return () => StatusBar.popStackEntry(entry);
  }, []));

  const step: OnboardingStep = isReplay ? replayStep : state.step === 'path' ? 'path' : 'intro';
  // The first act plays once. Coming back to the intro replays a quick entrance, and a
  // resumed session that opens on the path step never sees the arrival at all.
  const [visitedPath, setVisitedPath] = useState(state.step === 'path');
  // Derived from the step during render (not in an effect) so the return visit never
  // flashes the arrival choreography for a frame.
  if (step === 'path' && !visitedPath) setVisitedPath(true);
  const arrival = step === 'intro' && !visitedPath;
  const enter = (active: boolean, delay: number, travel: number): CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>> => {
    if (!active) return { animationName: 'none' };
    const scaled = arrival ? delay : delay * STORY.returnScale;
    return {
      animationName: {
        from: { opacity: 0, ...(!reducedMotion ? { transform: [{ translateY: travel }] } : {}) },
        to: { opacity: 1, ...(!reducedMotion ? { transform: [{ translateY: 0 }] } : {}) },
      },
      animationDuration: arrival ? STORY.arrive : STORY.enter,
      animationDelay: reducedMotion ? reducedDelay(scaled) : scaled,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    };
  };
  const introEnter = (delay: number) => enter(step === 'intro', delay, TRAVEL.arrive);
  // One soft ring once the loop has been told: an invitation, not a nag. Never repeats.
  const ctaInvite: CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>> = {
    animationName: {
      '0%': { opacity: 0, transform: [{ scaleX: 1 }, { scaleY: 1 }] },
      '30%': { opacity: 0.6 },
      '100%': { opacity: 0, transform: [{ scaleX: 1.05 }, { scaleY: 1.22 }] },
    },
    animationDuration: 1400,
    animationDelay: STORY.ctaInvite,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  };
  // Committing pushes the camera in (NightSky); the copy recedes with it.
  const recede: CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>> = {
    opacity: isLeaving ? 0 : 1,
    transform: [{ scale: isLeaving && !reducedMotion ? 0.97 : 1 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: STORY.plunge / 2,
    transitionTimingFunction: EASE.out,
  };
  // Night to day: on leaving, the next screen's ground fades in over the scene so the
  // handoff to Capture reads as one gesture rather than a hard cut. Navigation waits for
  // it; reduce motion skips the wait.
  const exitFadeStyle: CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>> = {
    opacity: isLeaving ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: STORY.exitFade,
    transitionDelay: isLeaving ? STORY.exitFadeDelay : 0,
    transitionTimingFunction: EASE.inOut,
  };
  const signalNodes = useMemo<LoopNode[]>(() => SIGNALS.map((signal) => ({
    id: signal.id,
    icon: signal.icon,
    title: t(`onboarding.intro.signal.${signal.copy}.title`),
    body: t(`onboarding.intro.signal.${signal.copy}.body`),
  })), [t]);
  const pathEnter = (delay: number) => enter(step === 'path', delay, TRAVEL.step);
  const titleAccent = noctalia.accent.text;
  const background = noctalia.screen.background;
  const backgroundUri = Asset.fromModule(BACKGROUND_IMAGE).uri;
  const backgroundWebStyle = useMemo(
    () => ({
      backgroundImage: `url("${backgroundUri}")`,
      backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }) as unknown as ViewStyle,
    [backgroundUri]
  );
  const largeText = fontScale > 1.2;
  const artworkFraction = step === 'path'
    ? (largeText ? 0.10 : 0.18)
    : (largeText ? 0.18 : 0.25);
  const artworkSpace = Math.max(72, Math.min(260, viewportHeight * artworkFraction));

  useEffect(() => {
    if (loading || pathPreloaded || step === 'path' || isLeaving) return;
    const task = scheduleIdleTask(() => {
      // The screen can start leaving between scheduling and draining this task.
      // Mounting the path layer into a detaching screen makes Fabric insert a
      // subtree while `react-native-screens` re-parents the same surface.
      if (isLeavingRef.current) return;
      setPathPreloaded(true);
    });
    return () => task.cancel();
  }, [isLeaving, loading, pathPreloaded, step]);

  useEffect(() => {
    if (isReplay || loading || startedRef.current || state.status !== 'not_started') return;
    startedRef.current = true;
    void transition({ type: 'START' })
      .then(() => trackProductEvent('onboarding_started', { experience_version: 2 }))
      .catch(() => {
        startedRef.current = false;
        setFailedAction({ type: 'start' });
      });
  }, [isReplay, loading, state.status, transition]);

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
    if (isReplay) {
      setReplayStep(nextStep);
      return;
    }
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
  }, [isReplay, transition]);

  const startIntro = () => {
    if (!featureSheetsEnabled || guidedTourSeenRef.current) {
      void runStepTransition('path');
      return;
    }
    guidedTourSeenRef.current = true;
    setActiveFeature('capture');
  };

  const passThroughDoor = () => {
    guidedTourSeenRef.current = true;
    setActiveFeature(null);
    setDoorPassage(true);
  };

  // Closing the guided stories skips straight to the path.
  // Leaving the stories skips to the path step, the last one of the onboarding.
  const leaveStories = () => {
    guidedTourSeenRef.current = true;
    setActiveFeature(null);
    void runStepTransition('path');
  };

  // The cross means "I want out": confirm first, so a stray tap does not end the stories.
  const confirmLeaveStories = () => {
    const title = t('onboarding.story.leave.title');
    const message = t('onboarding.story.leave.message');
    // react-native-web's Alert is a no-op: use the browser's own confirmation there.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(`${title}\n\n${message}`)) leaveStories();
      return;
    }
    Alert.alert(title, message, [
      { text: t('onboarding.story.leave.stay'), style: 'cancel' },
      { text: t('onboarding.story.leave.confirm'), onPress: leaveStories },
    ], { cancelable: true });
  };

  const waitForExitFade = useCallback(() => (reducedMotion
    ? Promise.resolve()
    : new Promise<void>((resolve) => setTimeout(resolve, STORY.exitFadeDelay + STORY.exitFade))), [reducedMotion]);

  /** A replay ends where it started, without touching the saved onboarding. */
  const leaveReplay = useCallback(async () => {
    isLeavingRef.current = true;
    setIsLeaving(true);
    await waitForExitFade();
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }, [waitForExitFade]);

  const completePath = useCallback(async (path: OnboardingPath) => {
    if (isLeavingRef.current || stepTransitionRef.current) return;
    if (isReplay) {
      await leaveReplay();
      return;
    }
    isLeavingRef.current = true;
    setIsLeaving(true);
    setFailedAction(null);
    const authReturn = getAuthReturnSnapshot().intent;
    try {
      const next = await transition({ type: 'COMPLETE', path });
      void trackProductEvent('onboarding_completed', {
        reason: path,
        experience_version: 2,
      });
      if (authReturn) return; // Root resumes only after persistence settles.
      await waitForExitFade();
      const pendingPaywall = peekReturnToPaywallTrigger();
      if (pendingPaywall) {
        // The user signed in from the paywall and onboarding intercepted the
        // redirect (fresh user scope): finish where they wanted to go.
        router.replace(buildPaywallHref(getPaywallTrigger(pendingPaywall)));
      } else if (path === 'dictionary') {
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
  }, [isReplay, leaveReplay, openRecording, transition, waitForExitFade]);

  const skip = useCallback(async () => {
    if (isLeavingRef.current) return;
    if (isReplay) {
      await leaveReplay();
      return;
    }
    isLeavingRef.current = true;
    setIsLeaving(true);
    setFailedAction(null);
    const authReturn = getAuthReturnSnapshot().intent;
    try {
      await transition({ type: 'SKIP' });
      void trackProductEvent('onboarding_choice_selected', {
        surface: 'app_onboarding',
        step,
        choice: 'skip',
      });
      void trackProductEvent('onboarding_completed', { reason: 'skip', experience_version: 2 });
      if (authReturn) return;
      await waitForExitFade();
      const pendingPaywall = peekReturnToPaywallTrigger();
      router.replace(pendingPaywall ? buildPaywallHref(getPaywallTrigger(pendingPaywall)) : '/recording');
    } catch {
      // See `completePath`: the idle CTA only comes back when we stay.
      isLeavingRef.current = false;
      setIsLeaving(false);
      setFailedAction({ type: 'skip' });
    }
  }, [isReplay, leaveReplay, step, transition, waitForExitFade]);

  const selectPath = useCallback((path: OnboardingPath) => {
    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    setSelectedPathOverride(path);
    setFailedAction(null);
    if (isReplay) return;
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
  }, [isReplay, state.selectedPath, transition]);

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
    const authReturn = getAuthReturnSnapshot().intent;
    continueForSession(reason);
    setFailedAction(null);
    void trackProductEvent('onboarding_completed', { reason, experience_version: 2 });
    if (authReturn) return;
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
      return true;
    } catch {
      setAnalyticsEnabled((current) => !current);
      setAnalyticsPreferenceError(true);
      return false;
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
        <ActivityIndicator color={noctalia.accent.text} />
      </View>
    );
  }

  const visibleError = Boolean(contextError || failedAction);
  const canContinueForSession = failedAction?.type === 'skip' || failedAction?.type === 'complete';
  const selectedPath = selectedPathOverride ?? state.selectedPath ?? 'analyze';
  const selectedDefinition = PATHS.find((path) => path.id === selectedPath) ?? PATHS[0];
  const analyticsAvailable = isProductAnalyticsAvailable();
  // The sheet's two answers: save the usage choice (when this build collects at all), then close.
  const answerPrivacy = async (accepted: boolean) => {
    if (analyticsAvailable && !(await toggleAnalytics(accepted))) return;
    setShowPrivacySheet(false);
  };
  const layeredStepHeight = Math.max(stepHeights.intro ?? 0, stepHeights.path ?? 0) || undefined;

  return (
    <View
      style={[styles.screen, { backgroundColor: background }]}
      testID={TID.Screen.Onboarding}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
        {Platform.OS === 'web' ? (
          <>
            <View style={[StyleSheet.absoluteFill, backgroundWebStyle]} />
            <LinearGradient
              colors={['rgba(3,4,13,0.12)', 'rgba(3,4,13,0.08)', 'rgba(3,4,13,0.60)', 'rgba(3,4,13,0.88)']}
              locations={[0, 0.25, 0.62, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <NightSky step={step} leaving={isLeaving} arrival={arrival} />
        )}
      </View>
      <Animated.ScrollView
        style={recede}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 12, 28),
            paddingBottom: footerHeight + 16,
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
          <View style={styles.stepProgress} accessible accessibilityLabel={t('onboarding.progress', { current: step === 'intro' ? 1 : 2, total: 2 })}>
            <View accessible={false} style={styles.stepMarks}>
              {[0, 1].map((index) => <Animated.View key={index} style={[styles.stepMark, {
                backgroundColor: titleAccent,
                opacity: index <= (step === 'intro' ? 0 : 1) ? 1 : 0.25,
                transitionProperty: 'opacity', transitionDuration: DURATION.fast, transitionTimingFunction: EASE.out,
              }]} />)}
            </View>
            <Text accessible={false} style={[styles.stepNumber, { color: noctalia.text.secondary }]}>{step === 'intro' ? '01' : '02'}{' / 02'}</Text>
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
          // Keep this stage and its step layers as real native views: letting
          // Fabric flatten/unflatten them while router.replace() detaches the
          // screen reparents their children mid-commit and crashes Android
          // with "addViewAt: view already has a parent".
          collapsable={false}
          style={Platform.OS === 'android'
            ? [
                styles.stepStage,
                styles.column,
                {
                  height: layeredStepHeight,
                },
              ]
            : styles.column}
        >
          <View
            collapsable={false}
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
            <View collapsable={false} style={[styles.intro, { width: '100%' }]}>

            <View style={{ height: artworkSpace }} accessible={false} />
            {/* A soft dark pool behind the copy, so the subtitle and legends stay readable
                wherever the painting's moon and clouds fall at this screen size. */}
            <View pointerEvents="none" accessible={false} style={[styles.copyVeil, { top: artworkSpace - 70 }]}>
              <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id="copyVeil" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor="#03040D" stopOpacity="0.72" />
                    <Stop offset="0.62" stopColor="#03040D" stopOpacity="0.45" />
                    <Stop offset="1" stopColor="#03040D" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="50" cy="50" rx="50" ry="50" fill="url(#copyVeil)" />
              </Svg>
            </View>
            <View style={styles.titleBlock}>
              <Animated.View style={introEnter(STORY.titleLead)}>
                <Text
                  ref={introTitleRef}
                  {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={`${t('onboarding.intro.title_lead')} ${t('onboarding.intro.title_accent')}`}
                  onLayout={() => handleTitleLayout('intro')}
                  style={[styles.title, webTitleFocusResetStyle, { color: noctalia.text.primary }]}
                >
                  {t('onboarding.intro.title_lead')}
                </Text>
              </Animated.View>
              <Animated.View style={introEnter(STORY.titleAccent)} accessible={false} importantForAccessibility="no-hide-descendants">
                <Text style={[styles.title, styles.titleAccent, { color: titleAccent }]}>
                  {t('onboarding.intro.title_accent')}
                </Text>
              </Animated.View>
            </View>
            <Animated.View style={introEnter(STORY.subtitle)}>
              <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
                {t('onboarding.intro.subtitle')}
              </Text>
            </Animated.View>
            <Animated.View
              style={[styles.signalList, visitedPath ? introEnter(STORY.node) : null]}
              testID={TID.Component.OnboardingIntroSignals}
            >
              <LoopConstellation
                nodes={signalNodes}
                accent={titleAccent as string}
                text={noctalia.text.primary as string}
                muted={noctalia.text.secondary as string}
                play={arrival && step === 'intro'}
                renderNode={(node, content) => {
                  if (!featureSheetsEnabled) {
                    return <View testID={`btn.onboarding.feature.${node.id}`}>{content}</View>;
                  }
                  const feature = node.id as OnboardingFeature;
                  return (
                    <PressableScale
                      ref={(handle) => { featureTriggers.current[feature] = handle; }}
                      accessibilityRole="button"
                      accessibilityLabel={node.title}
                      accessibilityHint={t('onboarding.feature.open_hint')}
                      onPress={() => {
                        if (featureFocusTimer.current) clearTimeout(featureFocusTimer.current);
                        setActiveFeature(feature);
                      }}
                      disabled={isLeaving || isStepTransitioning}
                      testID={`btn.onboarding.feature.${node.id}`}
                    >
                      {content}
                    </PressableScale>
                  );
                }}
              />
            </Animated.View>
            <Animated.View style={introEnter(STORY.privacy)}>
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
            </Animated.View>
            </View>
          </View>

          {pathPreloaded || step === 'path' ? (
            <View
              collapsable={false}
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
            <View collapsable={false} style={[styles.paths, { width: '100%' }]}>

            <View style={{ height: artworkSpace }} accessible={false} />
            <View style={styles.titleBlock}>
              <Animated.View style={pathEnter(STORY.titleLead - 200)}>
                <Text
                  ref={pathTitleRef}
                  {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={`${t('onboarding.path.title_lead')} ${t('onboarding.path.title_accent')}`}
                  onLayout={() => handleTitleLayout('path')}
                  style={[styles.pathHeading, webTitleFocusResetStyle, { color: noctalia.text.primary }]}
                >
                  {t('onboarding.path.title_lead')}
                </Text>
              </Animated.View>
              <Animated.View style={pathEnter(STORY.titleLead)} accessible={false} importantForAccessibility="no-hide-descendants">
                <Text style={[styles.pathHeading, styles.titleAccent, { color: titleAccent }]}>
                  {t('onboarding.path.title_accent')}
                </Text>
              </Animated.View>
            </View>
            <Animated.View style={pathEnter(STORY.titleLead + 120)}>
              <Text style={[styles.pathSubtitle, { color: noctalia.text.secondary }]}>
                {t('onboarding.subtitle')}
              </Text>
            </Animated.View>
            <View style={styles.pathList}>
              {PATHS.map((path, index) => {
                const selected = path.id === selectedPath;
                return (
                  <Animated.View key={path.id} style={pathEnter(STORY.titleLead + 220 + index * STORY.stepStagger)}>
                    <Pressable
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityState={{ checked: selected }}
                      onPress={() => selectPath(path.id)}
                      style={({ pressed }) => [
                        styles.pathRow,
                        { borderColor: noctalia.surface.border },
                        pressed && styles.pathRowPressed,
                      ]}
                      testID={TID.Button.OnboardingPath(path.id)}
                    >
                      <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.pathSelection, {
                        borderColor: titleAccent,
                        backgroundColor: 'rgba(234,212,180,0.10)',
                        opacity: selected ? 1 : 0,
                        transitionProperty: 'opacity', transitionDuration: DURATION.fast, transitionTimingFunction: EASE.out,
                      }]} />
                      <View style={[styles.pathIcon, { borderColor: selected ? titleAccent : noctalia.surface.border }]}>
                        <IconSymbol name={path.icon} size={23} color={titleAccent as ColorValue} />
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
                  </Animated.View>
                );
              })}
            </View>
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
      </Animated.ScrollView>

      <View
        onLayout={handleFooterLayout}
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + 10, 18),
            backgroundColor: 'transparent',
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(3,4,13,0)', 'rgba(3,4,13,0.92)', background]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.column, arrival ? introEnter(STORY.cta) : null]}>
        {arrival && !reducedMotion ? (
          <Animated.View pointerEvents="none" style={[styles.ctaInvite, { borderColor: titleAccent }, ctaInvite]} />
        ) : null}
        <Pressable
          accessibilityLabel={step === 'intro'
            ? t('onboarding.intro.cta')
            : t(`onboarding.path.${selectedDefinition.id}.cta`)}
          accessibilityRole="button"
          onPress={() => step === 'intro'
            ? startIntro()
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
              <Text style={[styles.primaryText, { color: noctalia.action.primaryText }]}>
                {step === 'intro'
                  ? t('onboarding.intro.cta')
                  : t(`onboarding.path.${selectedDefinition.id}.cta`)}
              </Text>
              <IconSymbol name="arrow.right" size={22} color={noctalia.action.primaryText} />
            </View>
          )}
        </Pressable>
        </Animated.View>
      </View>

      {featureSheetsEnabled && activeFeature ? (
        <React.Suspense fallback={null}>
          <OnboardingFeatureSheet feature={activeFeature} onClose={confirmLeaveStories}
            onFeatureChange={setActiveFeature} ending={{
              label: t('onboarding.narrative.finish_guided'),
              restartLabel: t('onboarding.narrative.restart'),
              onFinish: passThroughDoor,
            }} />
        </React.Suspense>
      ) : null}

      {doorPassage ? <React.Suspense fallback={<View style={[StyleSheet.absoluteFill, styles.doorFallback]} />}>
        <DoorPassage onCovered={() => void runStepTransition('path')} onDone={() => setDoorPassage(false)} />
      </React.Suspense> : null}

      {showPrivacySheet ? <StandardBottomSheet
        visible
        onClose={() => setShowPrivacySheet(false)}
        title={t('onboarding.privacy.title')}
        subtitle={t('onboarding.privacy.body')}
        testID={TID.Sheet.OnboardingPrivacy}
        // Accepting and refusing weigh the same: one tap each, then the sheet closes on the saved choice.
        actions={{
          primaryLabel: t('onboarding.privacy.accept'),
          onPrimary: () => void answerPrivacy(true),
          primaryLoading: analyticsPreferenceLoading,
          secondaryLabel: t('onboarding.privacy.refuse'),
          onSecondary: () => void answerPrivacy(false),
        }}
      >
        {/* Three plain promises, one line each; the policy holds the details. */}
        <View style={styles.privacyPoints}>
          {([
            ['lock.fill', 'onboarding.privacy.private'],
            ['sparkles', 'onboarding.privacy.ai_body'],
            ['chart.bar', 'onboarding.privacy.no_content'],
          ] as const).map(([icon, key]) => (
            <View key={key} style={styles.privacyPoint} testID={key === 'onboarding.privacy.ai_body' ? 'component.onboarding.privacy.ai' : undefined}>
              <IconSymbol name={icon} size={18} color={sheetTokens.accent.text} />
              <Text style={[styles.privacyAssuranceText, { color: sheetTokens.text.secondary }]}>{t(key)}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.privacyDetails, { color: sheetTokens.text.tertiary }]}>{t('onboarding.privacy.details')}</Text>
        <Text style={[styles.privacyToggleLabel, { color: sheetTokens.text.primary }]}>{t('onboarding.privacy.toggle_label')}</Text>
        {analyticsPreferenceError || !analyticsAvailable ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.privacyStatus, { color: analyticsPreferenceError ? sheetTokens.status.danger.text : sheetTokens.accent.text }]}
          >
            {analyticsPreferenceError ? t('onboarding.privacy.error') : t('analytics.privacy.unavailable')}
          </Text>
        ) : null}
      </StandardBottomSheet> : null}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { backgroundColor: sheetTokens.screen.background }, exitFadeStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Holds the night over the screen if the door is still loading when the reader steps through.
  doorFallback: { zIndex: 100, backgroundColor: ONBOARDING_TOKENS.screen.background },
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 8 },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stepProgress: { alignItems: 'center', gap: 6, marginLeft: -20 },
  stepMarks: { flexDirection: 'row', gap: 5 },
  stepMark: { width: 18, height: 2, borderRadius: 1 },
  stepNumber: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  topBarLeading: { position: 'relative', minWidth: 80, height: 44, justifyContent: 'center' },
  topBarBack: { position: 'absolute', top: 0, left: 0 },
  brand: { fontFamily: Fonts.fraunces.regular, fontSize: 26, lineHeight: 32, minWidth: 80 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipButton: { minWidth: 72, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15 },
  intro: { alignItems: 'center', gap: 16 },
  title: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 520,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  signalList: { width: '100%', alignItems: 'center' },
  titleBlock: { alignItems: 'center' },
  titleAccent: { marginTop: -2 },
  privacyLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  privacyLinkText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 13, textDecorationLine: 'underline' },
  stepStage: { position: 'relative', alignSelf: 'stretch' },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  copyVeil: { position: 'absolute', left: -60, right: -60, height: 560 },
  stepLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  inactiveStepLayer: { opacity: 0 },
  inactiveControl: { opacity: 0 },
  paths: { gap: 12 },
  hiddenStep: { display: 'none' },
  pathHeading: { fontFamily: Fonts.fraunces.regular, fontSize: 34, lineHeight: 40, textAlign: 'center' },
  pathSubtitle: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pathList: { marginTop: 10, gap: 10 },
  pathRow: { minHeight: 88, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: 'rgba(14, 10, 26, 0.72)' },
  pathRowPressed: { transform: [{ scale: 0.985 }] },
  pathSelection: { borderWidth: 1, borderRadius: 22, borderCurve: 'continuous' },
  pathIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,4,13,0.45)' },
  pathCopy: { flex: 1, gap: 4 },
  pathTitle: { fontFamily: Fonts.fraunces.medium, fontSize: 19, lineHeight: 24 },
  pathBody: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  errorCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  errorText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  errorButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingHorizontal: 12 },
  errorButtonText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 13 },
  ctaInvite: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderRadius: 28, borderCurve: 'continuous' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 10 },
  primaryButton: { minHeight: 56, borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 14 },
  primaryText: { flexShrink: 1, fontFamily: Fonts.spaceGrotesk.bold, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  privacyAssuranceText: { flex: 1, fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 19 },
  privacyPoints: { gap: 12, marginBottom: 14 },
  privacyDetails: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 17, marginBottom: 18 },
  privacyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privacyToggleLabel: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 20 },
  privacyStatus: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 16 },
});
