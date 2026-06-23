import { IconSymbol } from '@/components/ui/icon-symbol';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getOnboardingCompletionFlags,
  type OnboardingCompletionIntent,
} from '@/lib/onboardingCompletion';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';
import {
  saveFirstLaunchCompleted,
  saveRecordingInputModePreference,
  saveRecordingOnboardingCompleted,
  saveRememberedDreamPromptDismissed,
} from '@/services/storageService';
import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ColorValue,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OnboardingPathId = 'analyze' | 'memory' | 'library';
type OnboardingStep = 'intro' | 'paths' | 'capture';
type IntroSignalId = 'capture' | 'decode' | 'profile';

type OnboardingPath = {
  id: OnboardingPathId;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  action: 'fresh' | 'remembered' | 'library';
};

const ONBOARDING_PATHS: OnboardingPath[] = [
  {
    id: 'analyze',
    icon: 'moon.stars.fill',
    action: 'fresh',
  },
  {
    id: 'memory',
    icon: 'clock',
    action: 'remembered',
  },
  {
    id: 'library',
    icon: 'book.closed.fill',
    action: 'library',
  },
];

const INTRO_SIGNALS: {
  id: IntroSignalId;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
}[] = [
  {
    id: 'capture',
    icon: 'pencil',
  },
  {
    id: 'decode',
    icon: 'eye.fill',
  },
  {
    id: 'profile',
    icon: 'sparkles',
  },
];

const INTRO_BACKGROUND_IMAGE = require('@/assets/images/onboarding-astral-background.png');
const PATH_BACKGROUND_IMAGE = require('@/assets/images/onboarding-path-background.png');
const CAPTURE_BACKGROUND_IMAGE = require('@/assets/images/onboarding-capture-background.png');

const CAPTURE_MODES: {
  id: RecordingInputModePreference;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
}[] = [
  {
    id: 'text',
    icon: 'pencil',
  },
  {
    id: 'voice',
    icon: 'mic',
  },
];

export default function OnboardingScreen() {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [selectedPathId, setSelectedPathId] = useState<OnboardingPathId>('analyze');
  const [selectedCaptureMode, setSelectedCaptureMode] =
    useState<RecordingInputModePreference>('text');
  const [isLeaving, setIsLeaving] = useState(false);

  const selectedPath = useMemo(
    () => ONBOARDING_PATHS.find((path) => path.id === selectedPathId) ?? ONBOARDING_PATHS[0],
    [selectedPathId]
  );

  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const immersiveNoctalia = useMemo(() => getNoctaliaDesignTokens(DarkTheme, 'dark'), []);
  const screenBackground = noctalia.screen.background;
  const introWheat = noctalia.accent.base;
  const introWheatSoft = noctalia.accent.soft;
  const introOnWheat = noctalia.text.onAccent;
  const introPrimaryText = noctalia.text.primary;
  const introMutedText = noctalia.text.secondary;
  const heroOverlayPrimary = step === 'intro' ? introPrimaryText : immersiveNoctalia.text.primary;
  const heroOverlayAccent = step === 'intro' ? introWheatSoft : immersiveNoctalia.accent.soft;
  const introSceneHeight = Math.max(320, Math.min(370, viewportWidth * 0.88));
  const introBackgroundUri = Asset.fromModule(INTRO_BACKGROUND_IMAGE).uri;
  const pathBackgroundUri = Asset.fromModule(PATH_BACKGROUND_IMAGE).uri;
  const captureBackgroundUri = Asset.fromModule(CAPTURE_BACKGROUND_IMAGE).uri;
  const introBackgroundWebStyle = useMemo(() => ({
    backgroundImage: `url("${introBackgroundUri}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
  }) as unknown as ViewStyle, [introBackgroundUri]);
  const pathBackgroundWebStyle = useMemo(() => ({
    backgroundImage: `url("${pathBackgroundUri}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  }) as unknown as ViewStyle, [pathBackgroundUri]);
  const captureBackgroundWebStyle = useMemo(() => ({
    backgroundImage: `url("${captureBackgroundUri}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  }) as unknown as ViewStyle, [captureBackgroundUri]);
  const stickyFooterPaddingBottom = Math.max(insets.bottom + 10, 18);
  const scrollBottomPadding = stickyFooterPaddingBottom + (step === 'intro' ? 114 : 106);

  const applyOnboardingCompletion = useCallback(async (intent: OnboardingCompletionIntent) => {
    const flags = getOnboardingCompletionFlags(intent);
    const saves: Promise<void>[] = [saveFirstLaunchCompleted(flags.firstLaunchCompleted)];

    if (flags.recordingOnboardingCompleted) {
      saves.push(saveRecordingOnboardingCompleted(true));
    }

    if (flags.rememberedDreamPromptDismissed) {
      saves.push(saveRememberedDreamPromptDismissed(true));
    }

    await Promise.all(saves);
  }, []);

  const openDreamLibrary = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await applyOnboardingCompletion('library');
      router.replace('/symbol-dictionary');
    } finally {
      setIsLeaving(false);
    }
  }, [applyOnboardingCompletion, isLeaving]);

  const continueSelectedPath = useCallback(() => {
    if (selectedPath.action === 'library') {
      void openDreamLibrary();
      return;
    }

    setStep('capture');
  }, [openDreamLibrary, selectedPath.action]);

  const continueCaptureMode = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await saveRecordingInputModePreference(selectedCaptureMode);

      if (selectedPath.action === 'remembered') {
        await applyOnboardingCompletion('rememberedCapture');
        router.replace({
          pathname: '/recording',
          params: {
            intent: 'remembered',
            source: 'onboarding',
          },
        });
        return;
      }

      await applyOnboardingCompletion('freshCapture');
      router.replace('/recording');
    } finally {
      setIsLeaving(false);
    }
  }, [applyOnboardingCompletion, isLeaving, selectedCaptureMode, selectedPath.action]);

  const skipOnboarding = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await applyOnboardingCompletion('skip');
      router.replace('/recording');
    } finally {
      setIsLeaving(false);
    }
  }, [applyOnboardingCompletion, isLeaving]);

  return (
    <View style={[styles.screen, { backgroundColor: screenBackground }]} testID={TID.Screen.Onboarding}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          step === 'intro' ? styles.introContent : styles.content,
          {
            paddingTop: Math.max(insets.top + 18, 34),
            paddingBottom: scrollBottomPadding,
          },
        ]}
      >
        <View style={[styles.topBar, step === 'intro' && styles.introTopBar, styles.pathTopBar]}>
          <Text style={[styles.brand, step === 'intro' && styles.introBrand, step !== 'intro' && styles.pathBrand, { color: heroOverlayPrimary }]}>Noctalia</Text>
          {step === 'intro' ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={skipOnboarding}
              disabled={isLeaving}
              hitSlop={10}
              style={styles.skipButton}
              testID={TID.Button.OnboardingSkip}
            >
              <Text style={[styles.skipText, { color: heroOverlayAccent }]}>
                {t('onboarding.skip')}
              </Text>
            </Pressable>
          )}
        </View>

        {step === 'intro' ? (
          <View style={styles.intro} testID={TID.Component.OnboardingIntro}>
            <View style={[styles.introScene, { height: introSceneHeight }]}>
              {Platform.OS === 'web' ? (
                <View style={[styles.introSceneImage, introBackgroundWebStyle]} />
              ) : (
                <Image
                  source={INTRO_BACKGROUND_IMAGE}
                  resizeMode="contain"
                  style={styles.introSceneImage}
                />
              )}
              <View style={styles.introSceneFade} />
            </View>

            <View style={styles.introCopy}>
              <Text style={[styles.title, styles.introTitle, { color: introPrimaryText }]}>
                {t('onboarding.intro.title')}
              </Text>
              <Text style={[styles.subtitle, styles.introSubtitle, { color: introMutedText }]}>
                {t('onboarding.intro.subtitle')}
              </Text>
            </View>

            <View
              style={styles.introSignals}
              testID={TID.Component.OnboardingIntroSignals}
            >
              {INTRO_SIGNALS.map((signal, index) => (
                <React.Fragment key={signal.id}>
                  <View style={styles.signalColumn}>
                    <View
                      style={[
                        styles.signalIcon,
                        {
                          backgroundColor: noctalia.surface.soft,
                          borderColor: noctalia.surface.borderStrong,
                          shadowColor: introWheat,
                        },
                      ]}
                    >
                      <IconSymbol name={signal.icon} size={28} color={introWheat as ColorValue} />
                    </View>
                    <Text style={[styles.signalTitle, { color: introWheat }]}>
                      {t(`onboarding.intro.signal.${signal.id}.title`)}
                    </Text>
                    <Text style={[styles.signalBody, { color: introMutedText }]}>
                      {t(`onboarding.intro.signal.${signal.id}.body`)}
                    </Text>
                  </View>
                  {index < INTRO_SIGNALS.length - 1 ? (
                    <View style={[styles.signalDivider, { backgroundColor: `${introWheatSoft}2E` }]} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        ) : step === 'paths' ? (
          <>
            <View style={styles.pathHero}>
              <View style={[styles.pathScene, { backgroundColor: screenBackground }]}>
                {Platform.OS === 'web' ? (
                  <View style={[styles.pathSceneImage, pathBackgroundWebStyle]} />
                ) : (
                  <Image
                    source={PATH_BACKGROUND_IMAGE}
                    resizeMode="cover"
                    style={styles.pathSceneImage}
                  />
                )}
              </View>
              <Text style={[styles.pathTitleHero, { color: introPrimaryText }]}>
                {t('onboarding.title') === 'Choisis ton point de départ' ? (
                  <>
                    Choisis ton{'\n'}
                    <Text style={[styles.pathTitleHeroAccent, { color: introWheat }]}>point de départ</Text>
                  </>
                ) : (
                  t('onboarding.title')
                )}
              </Text>
            </View>

            <View
              style={[
                styles.paths,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.borderStrong,
                },
              ]}
            >
              {ONBOARDING_PATHS.map((path) => {
                const isSelected = path.id === selectedPathId;
                const isLast = path.id === ONBOARDING_PATHS[ONBOARDING_PATHS.length - 1].id;
                const pathAccent = path.id === 'memory' ? introWheatSoft : introWheat;

                return (
                  <Pressable
                    key={path.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedPathId(path.id)}
                    style={[
                      styles.pathRow,
                      {
                        borderBottomColor: isLast ? 'transparent' : noctalia.surface.border,
                      },
                    ]}
                    testID={TID.Button.OnboardingPath(path.id)}
                  >
                    <View
                      style={[
                        styles.pathIcon,
                        {
                          backgroundColor: noctalia.surface.soft,
                          borderColor: noctalia.surface.border,
                        },
                      ]}
                    >
                      <IconSymbol
                        name={path.icon}
                        size={28}
                        color={pathAccent as ColorValue}
                      />
                    </View>
                    <View style={styles.pathCopy}>
                      <Text style={[styles.pathTitle, { color: introPrimaryText }]}>
                        {t(`onboarding.path.${path.id}.title`)}
                      </Text>
                      <Text style={[styles.pathBody, { color: introMutedText }]}>
                        {t(`onboarding.path.${path.id}.body`)}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.pathCheck, { backgroundColor: pathAccent }]}>
                        <IconSymbol name="checkmark" size={14} color={introOnWheat} />
                      </View>
                    ) : (
                      <View style={[styles.pathRadio, { borderColor: `${introMutedText}8A` }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.capture} testID={TID.Component.OnboardingCapture}>
            <View style={styles.captureHero}>
              <View style={[styles.captureScene, { backgroundColor: screenBackground }]}>
                {Platform.OS === 'web' ? (
                  <View style={[styles.captureSceneImage, captureBackgroundWebStyle]} />
                ) : (
                  <Image
                    source={CAPTURE_BACKGROUND_IMAGE}
                    resizeMode="cover"
                    style={styles.captureSceneImage}
                  />
                )}
              </View>
              <Text style={[styles.captureTitle, { color: introPrimaryText }]}>
                {t('onboarding.capture.title') === 'Comment veux-tu raconter ?' ? (
                  <>
                    Comment veux-tu{'\n'}
                    <Text style={[styles.captureTitleAccent, { color: introWheat }]}>raconter</Text>
                    {' ?'}
                  </>
                ) : (
                  t('onboarding.capture.title')
                )}
              </Text>
            </View>

            <View
              style={[
                styles.paths,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.borderStrong,
                },
              ]}
            >
              {CAPTURE_MODES.map((mode) => {
                const isSelected = mode.id === selectedCaptureMode;
                const isLast = mode.id === CAPTURE_MODES[CAPTURE_MODES.length - 1].id;

                return (
                  <Pressable
                    key={mode.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedCaptureMode(mode.id)}
                    style={[
                      styles.pathRow,
                      styles.captureModeRow,
                      {
                        borderBottomColor: isLast ? 'transparent' : noctalia.surface.border,
                      },
                    ]}
                    testID={TID.Button.OnboardingCaptureMode(mode.id)}
                  >
                    <View
                      style={[
                        styles.pathIcon,
                        {
                          backgroundColor: noctalia.surface.soft,
                          borderColor: noctalia.surface.border,
                        },
                      ]}
                    >
                      <IconSymbol
                        name={mode.icon}
                        size={28}
                        color={introWheat as ColorValue}
                      />
                    </View>
                    <View style={styles.pathCopy}>
                      <Text style={[styles.pathTitle, { color: introPrimaryText }]}>
                        {t(`onboarding.capture.mode.${mode.id}.title`)}
                      </Text>
                      <Text style={[styles.pathBody, { color: introMutedText }]}>
                        {t(`onboarding.capture.mode.${mode.id}.body`)}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.pathCheck, { backgroundColor: introWheat }]}>
                        <IconSymbol name="checkmark" size={14} color={introOnWheat} />
                      </View>
                    ) : (
                      <View style={[styles.pathRadio, { borderColor: `${introMutedText}8A` }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.captureHint, { color: introMutedText }]}>
              {t('onboarding.capture.hint')}
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          {
            paddingHorizontal: step === 'intro' ? 32 : 20,
            paddingBottom: stickyFooterPaddingBottom,
            backgroundColor: screenBackground,
          },
        ]}
      >
        {step === 'intro' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep('paths')}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.introPrimaryButton,
              styles.stickyIntroPrimaryButton,
              {
                shadowColor: introWheat,
                opacity: pressed ? 0.86 : 1,
              },
            ]}
            testID={TID.Button.OnboardingIntroNext}
          >
            <View
              style={[
                styles.introPrimarySurface,
                {
                  backgroundColor: introWheat,
                  borderColor: introWheatSoft,
                },
              ]}
            >
              <Text style={[styles.primaryText, styles.introPrimaryText, { color: introOnWheat }]}>
                {t('onboarding.intro.cta')}
              </Text>
              <IconSymbol name="arrow.right" size={24} color={introOnWheat} />
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={step === 'paths' ? continueSelectedPath : continueCaptureMode}
            disabled={isLeaving}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.pathPrimaryButton,
              {
                backgroundColor: introWheat,
                shadowColor: introWheat,
                opacity: pressed || isLeaving ? 0.82 : 1,
              },
            ]}
            testID={TID.Button.OnboardingPrimary}
          >
            {isLeaving ? (
              <ActivityIndicator color={introOnWheat} />
            ) : (
              <>
                <Text style={[styles.primaryText, styles.pathPrimaryText, { color: introOnWheat }]}>
                  {step === 'paths'
                    ? t(`onboarding.path.${selectedPath.id}.cta`)
                    : t('onboarding.capture.cta')}
                </Text>
                <IconSymbol name="arrow.right" size={25} color={introOnWheat} />
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 20,
  },
  introContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
  },
  topBar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 2,
  },
  introTopBar: {
    paddingHorizontal: 20,
  },
  pathTopBar: {
    paddingTop: 4,
  },
  brand: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 24,
    lineHeight: 30,
  },
  introBrand: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 30,
    lineHeight: 36,
  },
  pathBrand: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 30,
    lineHeight: 36,
  },
  skipButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  intro: {
    flex: 1,
  },
  introScene: {
    marginTop: -8,
    marginHorizontal: -12,
    overflow: 'hidden',
  },
  introSceneImage: {
    width: '100%',
    height: '100%',
    opacity: 0.98,
  },
  introSceneFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 128,
    width: '100%',
  },
  introCopy: {
    gap: 10,
    marginTop: -18,
    paddingHorizontal: 24,
  },
  introTitle: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 34,
    lineHeight: 39,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  introSignals: {
    marginTop: 16,
    marginHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  signalColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  signalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  signalTitle: {
    fontFamily: Fonts.fraunces.medium,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  signalBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  signalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 82,
    marginHorizontal: 12,
    marginTop: 18,
  },
  pathHero: {
    gap: 10,
    marginTop: -68,
  },
  pathScene: {
    height: 268,
    marginHorizontal: -20,
    marginBottom: 2,
    overflow: 'hidden',
  },
  pathSceneImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  capture: {
    gap: 20,
  },
  captureHero: {
    gap: 18,
    marginTop: -68,
  },
  captureScene: {
    height: 292,
    marginHorizontal: -20,
    marginBottom: 0,
    overflow: 'hidden',
  },
  captureSceneImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  pathTitleHero: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 42,
    lineHeight: 48,
  },
  pathTitleHeroAccent: {
  },
  captureTitle: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 40,
    lineHeight: 47,
  },
  captureTitleAccent: {
  },
  pathSubtitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 31,
    lineHeight: 37,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  paths: {
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 0,
  },
  pathRow: {
    minHeight: 96,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  captureModeRow: {
    minHeight: 104,
    paddingVertical: 14,
  },
  captureHint: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 19,
    marginTop: -4,
    marginHorizontal: 24,
    textAlign: 'center',
  },
  pathIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathCopy: {
    flex: 1,
    gap: 8,
  },
  pathTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 21,
    lineHeight: 26,
  },
  pathBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  pathCheck: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathRadio: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  primaryActions: {
    gap: 8,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    zIndex: 8,
  },
  primaryButton: {
    minHeight: 66,
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  primaryText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    textAlign: 'center',
  },
  pathPrimaryButton: {
    minHeight: 64,
    borderRadius: 22,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  pathPrimaryText: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 25,
    lineHeight: 31,
  },
  introPrimaryButton: {
    minHeight: 66,
    marginHorizontal: 32,
    marginTop: 22,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: 0,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  stickyIntroPrimaryButton: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  introPrimarySurface: {
    minHeight: 66,
    width: '100%',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    borderWidth: 1,
  },
  introPrimaryText: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  freshButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  freshText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
