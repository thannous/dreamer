import type { LayoutChangeEvent, ViewInstance, ScrollViewInstance, TextInputInstance } from 'react-native';
import { getSavedAnalysisAction } from '@/lib/savedAnalysisAccess';
import { DreamAnalysisContent } from '@/components/journal/DreamAnalysisContent';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { CaptureOriginal } from '@/components/recording/CaptureOriginal';
import { getDreamRecallStorageId } from '@/lib/dreamRecallIdentity';
import { getDreamRouteParams, resolveDreamRoute } from '@/lib/dreamRoute';
import { getDreamIdentityKey, matchesDreamTarget } from '@/lib/dreamIdentity';
import { markPerformance, markPerformanceAfterFrames, performanceTraceId } from '@/lib/performanceTrace';
import { getInitialDreamCategorizationKey, isInitialDreamCategorizationPending, subscribeInitialDreamCategorization } from '@/lib/initialDreamCategorization';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { Toast } from '@/components/Toast';
import { DreamRecallAssistantCard } from '@/components/journal/DreamRecallAssistantCard';
import { BOOK_MEASURE, BookOrnament, BookProse, BookSectionMark, BookStar } from '@/components/journal/JournalBook';
import { JournalCoverPlate } from '@/components/journal/JournalCoverPlate';
import { JournalEditLink } from '@/components/journal/JournalEditLink';
import { JournalSealShare } from '@/components/journal/JournalSealShare';
import { JournalFolio } from '@/components/journal/JournalFolio';
import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPageTurner, useJournalPageLaidOut, useJournalPageTurnedTo, useJournalPageTurnLock } from '@/components/journal/JournalPageTurner';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalRunningHead, RUNNING_HEAD_GAP, RUNNING_HEAD_HEIGHT } from '@/components/journal/JournalRunningHead';
import { SavedDreamMoment, type SavedDreamAction, type SavedDreamPhase, type SealMark } from '@/components/journal/SavedDreamMoment';
import { CoverFlight } from '@/components/journal/story/CoverFlight';
import { SEAL_EMBLEMS, SEAL_MEASURES, SEAL_NAME_LINES } from '@/components/journal/story/sealMarks';
import { WrittenTitle } from '@/components/journal/story/WrittenTitle';
import { DreamPaintedArtwork } from '@/components/journal/story/DreamPaintedArtwork';
import { DreamPaintingWait } from '@/components/journal/story/DreamPaintingWait';
import { DREAM_STORY } from '@/components/journal/story/dreamStoryMotion';
import { WaitingStars } from '@/components/journal/story/WaitingStars';
import { markDreamStoryEpilogue } from '@/lib/dreamStoryEpilogue';
import { markDreamNamed } from '@/lib/dreamNaming';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import { getDreamStoryHandoffName, hasDreamStoryHandoff, markDreamStoryPageReady } from '@/lib/dreamStoryPrologue';
import { DreamShareImage } from '@/components/journal/DreamShareImage';
import { getImageJobFailure } from '@/lib/imageJobErrors';
import { ImageRetry } from '@/components/journal/ImageRetry';
import {
  AnalysisNoticeSheet,
  DeleteConfirmSheet,
  ImageErrorSheet,
  QuotaLimitSheet,
  ReanalyzeSheet,
  ReplaceImageSheet,
  type AnalysisNotice,
} from '@/components/journal/JournalDetailSheets';
import { DURATION, EASING, PressableScale, Reveal } from '@/components/motion';
import { QUOTAS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { SignInToOpenDream } from '@/components/auth/SignInToOpenDream';
import { dreamAuthReturnDestination } from '@/lib/authReturnIntent';
import { useOnboarding } from '@/context/OnboardingContext';
import { useDreamsData, useDreamsActions } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useDreamShareComposite } from '@/hooks/useDreamShareComposite';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { requestAiConsent } from '@/lib/aiConsent';
import { CONTACT_EMAIL, openContactMail } from '@/lib/contact';
import { blurActiveElement } from '@/lib/accessibility';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import { recordStoreReviewAnalysisRead, requestStoreReviewIfDue } from '@/lib/storeReview';
import {
  isRecoverablePendingAnalysis,
  isResumableAnalysisRequest,
} from '@/lib/analysisRequest';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { deriveDraftTitle, getDreamSyncState, normalizeDreamMemoryMetadata, sortDreams } from '@/lib/dreamUtils';
import {
  buildReflectionResumeHref,
  getDreamAnalysisState,
  getJournalDetailPrimaryFamily,
  getReflectionJourney,
  getReflectionQuotaHint,
  type ReflectionQuotaHint,
} from '@/lib/dreamUsage';
import { getDreamAnalysisFreshness } from '@/lib/dreamAnalysisFreshness';
import { isHdIllustrationsEnabled, isMockModeEnabled } from '@/lib/env';
import { classifyError, ErrorType, QuotaError, QuotaErrorCode } from '@/lib/errors';
import { getDreamImageVersion, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import {
  resolveJournalIllustrationAccess,
  resolveJournalIllustrationCta,
  resolveJournalIllustrationSidecar,
  shouldReplaceExistingImage,
  shouldShowCompletedJournalReading,
} from '@/lib/journalIllustrationPolicy';
import { getFileExtensionFromUrl, getMimeTypeFromExtension } from '@/lib/journal/shareImageUtils';
import { resolveJournalDreamRecallOfferEligible } from '@/lib/journalDreamRecallOffer';
import {
  isJournalSavedConfirmationParam,
  shouldOfferSavedDreamAnalysis,
} from '@/lib/journalSavedConfirmation';
import { FreeAnalysesNudge, getFreeAnalysesNudge } from '@/components/quota/FreeAnalysesNudge';
import { buildAnalysisPaywallHref, buildPaywallHref, consumePurchasedAnalysisReturn, hasPendingPurchasedAnalysisReturn } from '@/lib/paywallRoute';
import { sortWithSelectionFirst } from '@/lib/sorting';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';
import { getStaleAnalysisBannerDismissed, saveStaleAnalysisBannerDismissed } from '@/services/storageService';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  interpolate, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';
import { useFrameParallax, useHeaderScrollY } from '@/components/ui/scrollDepth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

const ReadingScrollView = Platform.OS === 'web' ? ScrollView : Animated.ScrollView;

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText?: (text: string) => Promise<void>;
  };
};

interface ShareImageData {
  source: string;
  extension: string;
  mimeType: string;
}

type SharePreparationStatus = 'ready' | 'failed' | 'stale';

interface ShareCompositeRequest {
  id: number;
  source: string;
  dream: DreamAnalysis;
  onMediaReady: (source: string, ready: boolean) => void;
}

interface PendingShareComposite {
  id: number;
  source: string;
  dreamIdentity: string;
  resolve: (status: SharePreparationStatus) => void;
}

const getShareNavigator = (): ShareNavigator | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator as ShareNavigator;
};

const DREAM_TYPES: DreamType[] = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream', 'Everyday Dream', 'Fantastical Dream'];
const isMockMode = isMockModeEnabled();
const DREAM_IMAGE_ASPECT = 9 / 16;
const DREAM_IMAGE_CROP_EPSILON = 0.01;
const GUEST_DEMO_QUOTA_WAIT_MS = 30_000;

const humanizeMemoryValue = (value: string): string => value.replace(/_/g, ' ');

const isTechnicalRevisionConflict = (message?: string | null): boolean =>
  String(message ?? '').toLowerCase().includes('revision conflict');

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type PickedImageAsset = {
  uri: string;
  width?: number;
  height?: number;
  base64?: string | null;
  mimeType?: string | null;
};

const getCenteredCropRect = (width: number, height: number, targetAspect: number) => {
  if (!width || !height) return null;
  const currentAspect = width / height;
  if (Math.abs(currentAspect - targetAspect) <= DREAM_IMAGE_CROP_EPSILON) return null;

  if (currentAspect > targetAspect) {
    const cropWidth = Math.floor(height * targetAspect);
    const originX = Math.max(0, Math.floor((width - cropWidth) / 2));
    return { originX, originY: 0, width: cropWidth, height };
  }

  const cropHeight = Math.floor(width / targetAspect);
  const originY = Math.max(0, Math.floor((height - cropHeight) / 2));
  return { originX: 0, originY, width, height: cropHeight };
};

const cropDreamImageToAspect = async (
  asset: PickedImageAsset,
  errorMessage: string
): Promise<PickedImageAsset> => {
  if (!asset.width || !asset.height) {
    throw new Error(errorMessage);
  }

  const crop = getCenteredCropRect(asset.width, asset.height, DREAM_IMAGE_ASPECT);
  if (!crop) {
    return asset;
  }

  try {
    const manipulator = await import('expo-image-manipulator');
    const result = await manipulator.manipulateAsync(asset.uri, [{ crop }], {
      compress: 1,
      format: manipulator.SaveFormat.JPEG,
      base64: Platform.OS === 'web',
    });

    return {
      ...asset,
      uri: result.uri,
      width: result.width,
      height: result.height,
      base64: result.base64 ?? asset.base64 ?? null,
      mimeType: 'image/jpeg',
    };
  } catch {
    throw new Error(errorMessage);
  }
};

/** After the medallion starts to settle, so the dream's own content follows it. */
const ARRIVAL_REVEAL_DELAY = 360;
/** On arrival from the capture seal, the next steps wait for the astrolabe to settle. */
/** Held back until the naming ends: an entrance that has not started yet. */
const ARRIVAL_NOT_YET = 60 * 60 * 1000;
/** How long the reading is held in place after the plate comes in above it. */
const PLATE_SETTLE_MS = 800;
/** On the web, a pause this long in the scrolling ends it, as the end of a drag does on a device. */
const SCROLL_REST_MS = 160;

/** Staggers the arrival from capture once; every other visit shows sections immediately. */
function ArrivalReveal({ play, index, className, children }: {
  play: boolean;
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return play
    ? <Reveal index={index} delay={ARRIVAL_REVEAL_DELAY} className={className}>{children}</Reveal>
    : <View className={className}>{children}</View>;
}

/** Where the running head has scrolled up under the page's top margin. */
const RUNNING_HEAD_TOP = 12;
/** How long a block appearing on the page takes to open up. */
const PAGE_FLOW_MS = 560;

/**
 * A block that appears on the page while it is read (the seal, its reading) opens up
 * instead of pushing what follows down at once; it then follows its content's height as
 * that grows. A block already there when the page opens is laid out as it is.
 */
function OpenUp({ appear, children, onLayout }: {
  appear: boolean;
  children: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const reduced = useReducedMotion();
  const [opening] = useState(appear && !reduced);
  const height = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ height: height.get() }));
  if (!opening) return <View onLayout={onLayout}>{children}</View>;
  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]} onLayout={onLayout}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={({ nativeEvent: { layout } }) => {
          height.set(withTiming(layout.height, { duration: PAGE_FLOW_MS, easing: EASING.inOut }));
        }}>
        {children}
      </View>
    </Animated.View>
  );
}
/** How far the reader scrolls back up before the way back returns, and on before it leaves. */
const RETURN_REVEAL = 24;
const RETURN_CONCEAL = 8;

/**
 * The way back to the journal once the running head has gone up with the page: away
 * while the page is read, it comes back as a small tab of the page's paper as soon as
 * the reader scrolls back up a little, and leaves when the reading goes on or the running
 * head is in sight again.
 */
function JournalReturnTab({ top, onPress }: { top: number; onPress: () => void }) {
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const ink = getNoctaliaDesignTokens(colors, mode).text.primary;
  const [reachable, setReachable] = useState(false);
  const wanted = useSharedValue(0);
  const shown = useSharedValue(0);
  const heading = useSharedValue(1);
  const turnedAt = useSharedValue(0);

  useAnimatedReaction(() => scrollY.get(), (y, previous) => {
    if (previous == null || y === previous) return;
    const way = y < previous ? -1 : 1;
    if (way !== heading.get()) {
      heading.set(way);
      turnedAt.set(previous);
    }
    const headGone = y > RUNNING_HEAD_TOP + RUNNING_HEAD_HEIGHT;
    let next = wanted.get();
    if (!headGone) next = 0;
    else if (way < 0 && turnedAt.get() - y >= RETURN_REVEAL) next = 1;
    else if (way > 0 && y - turnedAt.get() >= RETURN_CONCEAL) next = 0;
    if (next === wanted.get()) return;
    wanted.set(next);
    shown.set(withTiming(next, { duration: DURATION.fast, easing: EASING.out }));
    scheduleOnRN(setReachable, next === 1);
  });

  const tab = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduced ? 0 : interpolate(shown.get(), [0, 1], [-6, 0]) }],
  }));

  return (
    <Animated.View pointerEvents={reachable ? 'box-none' : 'none'} accessibilityElementsHidden={!reachable}
      importantForAccessibility={reachable ? 'auto' : 'no-hide-descendants'}
      style={[{ position: 'absolute', top, left: 16 }, tab]}>
      <PressableScale onPress={onPress} testID="journal.detail.returnTab" accessibilityRole="button"
        accessibilityLabel={t('journal.back_button')} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        className="h-10 w-10 items-center justify-center rounded-full border border-line bg-ink" style={shadows.sm}>
        <IconSymbol name="chevron.left" size={18} color={ink} />
      </PressableScale>
    </Animated.View>
  );
}

/**
 * On arrival from the seal, the page's secondary details and steps join once the dream has
 * been named. Keyed, so their entrance starts afresh then rather than resuming a delay.
 */
function ArrivalLater({ play, ready, children }: { play: boolean; ready: boolean; children: React.ReactNode }) {
  if (!play) return <>{children}</>;
  return <Reveal key={ready ? 'named' : 'naming'} delay={ready ? 120 : ARRIVAL_NOT_YET} distance={6}>{children}</Reveal>;
}

function JournalDetailScreen() {
  const route = useLocalSearchParams<{ id: string; remoteId?: string; clientRequestId?: string; saved?: string | string[] }>();
  // Arriving from the capture seal, the page has its own ceremony: it does not also fall shut.
  const [arrivedFromSeal] = useState(() => isJournalSavedConfirmationParam(route.saved));
  const { user } = useAuth();
  const { dreams } = useDreamsData();
  const dream = resolveDreamRoute(dreams, route);
  // The journal's pages in the order they were written: a later dream lies one page on.
  const neighbours = useMemo(() => {
    if (!dream) return { newer: null, older: null, folio: undefined };
    // Recomputed on every page turn. The journal is stored newest-first, so it is checked
    // rather than copied and sorted, and the page is found by reference before by key.
    const pages = dreams.every((page, index) => index === 0 || dreams[index - 1].id >= page.id)
      ? dreams : sortDreams(dreams);
    const exactIndex = pages.indexOf(dream);
    const dreamKey = exactIndex < 0 ? getDreamIdentityKey(dream) : null;
    const index = exactIndex >= 0 ? exactIndex : pages.findIndex((page) => getDreamIdentityKey(page) === dreamKey);
    return {
      newer: index > 0 ? pages[index - 1] : null,
      older: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
      // Pages are numbered from the first dream written.
      folio: index >= 0 ? pages.length - index : undefined,
    };
  }, [dream, dreams]);
  // Turning a page stays on this screen: the page's own arrival and offers do not follow it.
  const turnTo = useCallback((target: DreamAnalysis) => {
    router.setParams({
      ...getDreamRouteParams(target),
      remoteId: target.remoteId != null ? String(target.remoteId) : undefined,
      clientRequestId: target.clientRequestId || undefined,
      saved: undefined, recall: undefined, autoAnalyze: undefined, share: undefined,
      analyzeAfterPurchase: undefined, analysisOwnerId: undefined,
    });
  }, []);
  const content = <JournalDetailContent key={JSON.stringify([user?.id, route.id, route.remoteId, route.clientRequestId])}
    dream={dream} folio={neighbours.folio} />;
  return dream
    ? <JournalPageTurner newer={neighbours.newer} older={neighbours.older} folio={neighbours.folio} tonight hint={!arrivedFromSeal}
      onTurn={turnTo}>{content}</JournalPageTurner>
    : content;
}

const JournalDetailContent = memo(function JournalDetailContent({ dream, folio }: { dream?: DreamAnalysis; folio?: number }) {
  const { id, remoteId, clientRequestId, saved: savedParam, recall: recallParam, autoAnalyze: autoAnalyzeParam, analyzeAfterPurchase, analysisOwnerId, share: shareParam } = useLocalSearchParams<{ id: string; remoteId?: string; clientRequestId?: string; saved?: string | string[]; recall?: string | string[]; autoAnalyze?: string; analyzeAfterPurchase?: string; analysisOwnerId?: string; share?: string }>();
  const recallRequested = isJournalSavedConfirmationParam(recallParam);
  const { state: onboardingState, transition: transitionOnboarding } = useOnboarding();
  const [savedConfirmationVisible, setSavedConfirmationVisible] = useState(
    () => isJournalSavedConfirmationParam(savedParam)
  );
  const [isSavedArrival] = useState(
    () =>
      analyzeAfterPurchase !== '1' && shouldOfferSavedDreamAnalysis({
        savedParam,
        recallRequested,
        pendingPhase: onboardingState.pendingRecordingIntent?.phase,
        pendingSavedDreamId: onboardingState.pendingRecordingIntent?.savedDreamId,
        dreamId: id,
      })
  );
  // The arrival either opens on the saved moment or, with artwork already present, on the
  // cover with a toast. Decided once so the confirmation is never shown twice.
  const [opensOnSavedMoment] = useState(() => isSavedArrival && !dream?.imageUrl?.trim());
  // Arriving from the capture seal, the window is already open: it is taken over, not opened again.
  const [windowHandedOver] = useState(() => opensOnSavedMoment && !!dream && hasDreamStoryHandoff(dream));
  // First words that stood in for a name stay shown on this visit as they were written: a
  // pre-analysis that renames the dream later shows from its next opening, not under the
  // reader's eyes. Opening the name to edit it lets the current one show.
  const [heldTitle, setHeldTitle] = useState<string | null>(() => {
    const written = windowHandedOver && dream ? getDreamStoryHandoffName(dream) : undefined;
    return written?.provisional ? written.title : null;
  });
  // Act III: an illustration present when the dream is first shown opens the page as its
  // cover. One painted during this visit lands where the reader is instead, so nothing
  // they are reading moves; the cover becomes how the next visit opens.
  const [artworkAtArrival, setArtworkAtArrival] = useState<boolean | null>(
    () => dream ? Boolean(dream.imageUrl?.trim()) : null
  );
  if (artworkAtArrival === null && dream) {
    setArtworkAtArrival(Boolean(dream.imageUrl?.trim()));
  }
  // An illustration painted during this visit leaves the seal for the top of the page and
  // becomes its plate there, as every illustrated dream opens.
  const [plateRevealed, setPlateRevealed] = useState(false);
  // For a moment after the plate comes in above the reading, the reading is held where it was.
  const [plateSettling, setPlateSettling] = useState(false);
  const revealPlate = useCallback(() => {
    setPlateRevealed(true);
    setPlateSettling(true);
  }, []);
  useEffect(() => {
    if (!plateSettling) return;
    const timer = setTimeout(() => setPlateSettling(false), PLATE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [plateSettling]);
  const [coverFlight, setCoverFlight] = useState<{
    from: { x: number; y: number; size: number };
    to: { top: number; drift: number };
    landed: boolean;
  } | null>(null);
  const sealWindowRef = useRef<ViewInstance | null>(null);
  const analysisLaunchInFlightRef = useRef(false);
  const autoAnalysisHandledRef = useRef(false);
  const autoAnalysisExpiresAtRef = useRef<number | null>(null);
  const analysisPressInFlightRef = useRef(false);
  const purchaseAnalysisHandledRef = useRef(false);
  // The recall offer outlives the saved=1 param for the dream it was made for.
  const [recallEligibleDreamId, setRecallEligibleDreamId] = useState<string | null>(() =>
    resolveJournalDreamRecallOfferEligible({
      dreamId: id,
      savedParam,
      previouslyEligibleDreamId: null,
    }).eligibleDreamId
  );
  const recallOffer = resolveJournalDreamRecallOfferEligible({
    dreamId: id,
    savedParam,
    previouslyEligibleDreamId: recallEligibleDreamId,
  });
  if (recallOffer.eligibleDreamId !== recallEligibleDreamId) {
    setRecallEligibleDreamId(recallOffer.eligibleDreamId);
  }
  const {
    toggleFavorite,
    updateDream,
    deleteDream,
    retryDreamSync,
    resolveDreamConflict,
    generateDreamImage,
    analyzeDream,
    applyDreamCategorization,
  } = useDreamsActions();
  const { user } = useAuth();
  const { colors, shadows, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const compactTextScale = Math.min(1.3, Math.max(1, windowSize.fontScale));
  const titleTextScale = Math.min(1.4, Math.max(1, windowSize.fontScale));
  const metadataTextStyle = { fontSize: 14 * compactTextScale, lineHeight: 20 * compactTextScale };
  const [coverViewport, setCoverViewport] = useState<{ width: number; height: number } | null>(null);
  const [readingActionVisible, setReadingActionVisible] = useState(false);
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);
  const [actionDockHeight, setActionDockHeight] = useState(100);
  const [coverIntroHeight, setCoverIntroHeight] = useState<number | null>(null);
  const viewportHeight = coverViewport?.height ?? windowSize.height;
  const navigationHeight = insets.top + 76;
  // A page with its illustration opens on it as a plate filling the screen; the dream's
  // name is set at its foot, at its own measured height (including enlarged native text).
  const coverHeight = viewportHeight;
  // The illustration lies a little deeper than the page and drifts as it scrolls.
  const coverTravel = Math.round(coverHeight * 0.06);
  const headerScrollY = useHeaderScrollY();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { language } = useLanguage();
  useClearWebFocus();

  useEffect(() => {
    if (!isJournalSavedConfirmationParam(savedParam)) {
      return;
    }
    router.setParams({ saved: undefined });
  }, [savedParam]);
  const [isRetryingImage, setIsRetryingImage] = useState(false);
  const [illustrationAskedOnSeal, setIllustrationAskedOnSeal] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [syncRetryFailed, setSyncRetryFailed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecoveringMetadata, setIsRecoveringMetadata] = useState(false);
  const [metadataRecoveryFailed, setMetadataRecoveryFailed] = useState(false);
  const metadataRecoveryInFlightRef = useRef(false);
  const [analysisRecoveryClock, setAnalysisRecoveryClock] = useState(() => Date.now());
  const [showReplaceImageSheet, setShowReplaceImageSheet] = useState(false);
  const [showReanalyzeSheet, setShowReanalyzeSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [reanalyzeImagePolicy, setReanalyzeImagePolicy] = useState<'keep' | 'regenerate'>('keep');
  const [isIllustrationFullscreen, setIsIllustrationFullscreen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const [quotaSheetMode, setQuotaSheetMode] = useState<'quota' | 'login'>('quota');
  const [imageErrorMessage, setImageErrorMessage] = useState<string | null>(null);
  const [imageErrorCanRetry, setImageErrorCanRetry] = useState(true);
  const [imageErrorNeedsSubscription, setImageErrorNeedsSubscription] = useState(false);

  const trackedAnalysisResultRef = useRef<string | null>(null);
  const storeReviewAfterLeaveRef = useRef(false);

  useEffect(() => {
    if (isShareModalVisible) {
      blurActiveElement();
    }
  }, [isShareModalVisible]);
  const { formatDreamDate, formatDreamTime, formatDreamStamp } = useLocaleFormatting();
  const {
    canAnalyzeNow,
    canAnalyze,
    canGenerateImageNow,
    tier,
    usage,
    loading: quotaLoading,
    error: quotaError,
    quotaStatus,
  } = useQuota();
  const { t } = useTranslation();
  const isPlus = tier === 'plus';
  const savedAnalysisAction = getSavedAnalysisAction({
    tier, loading: quotaLoading, error: quotaError, status: quotaStatus,
  });
  // After an analysis, warn when the included analyses are about to run out.
  const lastFreeAnalysesNudge = getFreeAnalysesNudge({
    tier, signedIn: Boolean(user), loading: quotaLoading, error: quotaError, usage, maxRemaining: 1,
  });

  const canResumeAnalysis = Boolean(dream && isResumableAnalysisRequest(dream));
  const guestNeedsAccount = !user && !canResumeAnalysis
    && (savedAnalysisAction === 'signup' || savedAnalysisAction === 'login');
  const categorizationIdentity = dream ? getInitialDreamCategorizationKey(dream) : '';
  const getInitialCategorizationPending = useCallback(
    () => Boolean(categorizationIdentity && isInitialDreamCategorizationPending(categorizationIdentity)),
    [categorizationIdentity]
  );
  const initialCategorizationPending = useSyncExternalStore(
    subscribeInitialDreamCategorization,
    getInitialCategorizationPending,
    () => false
  );
  const latestMetadataDreamRef = useRef(dream);
  useLayoutEffect(() => {
    latestMetadataDreamRef.current = dream;
    return () => { latestMetadataDreamRef.current = undefined; };
  }, [dream]);
  const hasUncategorizedDraft = Boolean(dream && !dream.isAnalyzed && dream.analysisStatus !== 'pending'
    && !dream.theme && dream.title === deriveDraftTitle(dream.transcript, ''));
  const needsMetadataRecovery = hasUncategorizedDraft && !initialCategorizationPending;
  const recoverMetadata = useCallback(async () => {
    if (!dream || !needsMetadataRecovery || isInitialDreamCategorizationPending(getInitialDreamCategorizationKey(dream))
      || metadataRecoveryInFlightRef.current) return;
    // Metadata recovery sends the dream text to the AI provider.
    if (!(await requestAiConsent(t))) return;
    metadataRecoveryInFlightRef.current = true;
    setIsRecoveringMetadata(true);
    setMetadataRecoveryFailed(false);
    try {
      const result = await categorizeDream(dream.transcript, language);
      if (latestMetadataDreamRef.current !== dream) return;
      await applyDreamCategorization(dream, result);
    } catch {
      if (latestMetadataDreamRef.current === dream) setMetadataRecoveryFailed(true);
    } finally {
      metadataRecoveryInFlightRef.current = false;
      setIsRecoveringMetadata(false);
    }
  }, [applyDreamCategorization, dream, language, needsMetadataRecovery, t]);
  const handleImageUpgrade = useCallback(() => {
    router.push(buildPaywallHref('image_generation'));
  }, []);
  useEffect(() => {
    if (dream?.analysisStatus !== 'pending' || isAnalyzing) return undefined;

    const timer = setInterval(() => setAnalysisRecoveryClock(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [dream?.analysisStatus, dream?.clientUpdatedAt, dream?.updatedAt, isAnalyzing]);
  const dreamSyncState = useMemo(
    () => (dream && !isMockMode ? getDreamSyncState(dream) : 'clean'),
    [dream]
  );
  const media = useDreamMedia(dream);
  const hasExistingImage = useMemo(() => Boolean(dream?.imageUrl?.trim()), [dream?.imageUrl]);
  const dreamTypeLabel = useMemo(
    () => (dream ? getDreamTypeLabel(dream.dreamType, t) ?? dream.dreamType : undefined),
    [dream, t]
  );
  const dreamThemeLabel = useMemo(
    () => (dream ? getDreamThemeLabel(dream.theme, t) ?? dream.theme : undefined),
    [dream, t]
  );
  const dreamMemory = useMemo(
    () => (dream ? normalizeDreamMemoryMetadata(dream.memory) : undefined),
    [dream]
  );
  const dreamMemoryItems = useMemo(() => {
    if (!dreamMemory) return [];

    const translatedMemoryValue = (key: string, fallback: string) => {
      const label = t(key);
      return label === key ? humanizeMemoryValue(fallback) : label;
    };

    const items: { key: string; label: string; value: string }[] = [];

    if (dreamMemory.rememberedKind) {
      items.push({
        key: 'kind',
        label: t('recording.remembered_profile.kind_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.kind.${dreamMemory.rememberedKind}`,
          dreamMemory.rememberedKind,
        ),
      });
    }
    if (dreamMemory.approximatePeriod) {
      items.push({
        key: 'period',
        label: t('recording.remembered_profile.period_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.period.${dreamMemory.approximatePeriod}`,
          dreamMemory.approximatePeriod,
        ),
      });
    }
    if (dreamMemory.strongestFragment) {
      items.push({
        key: 'fragment',
        label: t('recording.remembered_profile.fragment_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.fragment.${dreamMemory.strongestFragment}`,
          dreamMemory.strongestFragment,
        ),
      });
    }
    if (items.length === 0) {
      items.push({
        key: 'origin',
        label: t('journal.detail.zone.memory'),
        value: t('recording.activation_insight.signal.memory'),
      });
    }

    return items;
  }, [dreamMemory, t]);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableTheme, setEditableTheme] = useState('');
  const [editableDreamType, setEditableDreamType] = useState('');
  const [editableTranscript, setEditableTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  // A page being written in, or its illustration held open, is not leafed through.
  useJournalPageTurnLock(isEditing || isIllustrationFullscreen);
  // A page just turned to takes over from its likeness once it has laid itself out: its
  // heading measured and its illustration, sized to it, on screen.
  const pageLaidOut = useJournalPageLaidOut();
  const turnedTo = useJournalPageTurnedTo();
  const [coverShown, setCoverShown] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Where the reading starts in the page: under the running head and the name, or the plate.
  const [readingContentTop, setReadingContentTop] = useState(insets.top + 76);
  const readingScrollOffset = useSharedValue(0);
  const readingContentRef = useRef<ViewInstance | null>(null);
  // Past the plate, the page's actions come in as soon as its reading is on the screen: the
  // seal and the analysis, which now come before the story, or the story itself.
  const readingActionThreshold = Math.max(1, readingContentTop - viewportHeight + Math.min(144, viewportHeight * 0.2));
  const updateReadingChrome = useCallback((offsetY: number) => {
    setReadingActionVisible(offsetY >= readingActionThreshold);
  }, [readingActionThreshold]);
  // Continuous offsets stay on the UI runtime. Only crossing the dock's threshold
  // changes React state; a long scroll never schedules a JS update per frame.
  // Rotation, text scaling and measured content move the threshold without a scroll
  // event: the reaction restarts with it and compares the latest observed offset.
  useAnimatedReaction(() => readingScrollOffset.get() >= readingActionThreshold,
    (visible, previous) => {
      if (visible !== previous) scheduleOnRN(setReadingActionVisible, visible);
    }, [readingActionThreshold]);
  const handleReadingScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      readingScrollOffset.set(event.contentOffset.y);
      headerScrollY.set(event.contentOffset.y);
    },
  });
  const scrollViewRef = useRef<ScrollViewInstance | null>(null);
  const editorScrollRef = useRef<ScrollViewInstance | null>(null);
  const recallInputRef = useRef<TextInputInstance | null>(null);
  const revealRecallInput = useCallback(() => {
    const input = recallInputRef.current;
    if (Platform.OS !== 'web' && input?.isFocused()) {
      scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(input, 24, true);
    }
  }, []);
  const handleRecallLayout = useCallback((input: TextInputInstance) => {
    if (Platform.OS !== 'web' && !input.isFocused()) {
      // The newly opened field must be reachable before its first focus hides the dock.
      scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(input, actionDockHeight + 24, true);
    }
  }, [actionDockHeight]);
  const handleRecallFocus = useCallback((input: TextInputInstance) => {
    recallInputRef.current = input;
    revealRecallInput();
  }, [revealRecallInput]);
  const editingStoryRef = useRef(false);
  const [lastAnalysisNotice, setLastAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const previousDreamRef = useRef(dream);

  const sortedDreamTypes = useMemo(() => {
    return sortWithSelectionFirst(DREAM_TYPES, dream?.dreamType);
  }, [dream?.dreamType]);

  const sortedDreamThemes = useMemo(() => {
    return sortWithSelectionFirst([...DREAM_THEMES], dream?.theme);
  }, [dream?.theme]);

  useEffect(() => {
    const changedDream = !dream || !previousDreamRef.current
      || !matchesDreamTarget(dream, previousDreamRef.current);
    previousDreamRef.current = dream;
    // Background categorization/sync refreshes the same dream object. Keep
    // active drafts until the user saves or cancels, and reset on navigation.
    if (changedDream || !isEditing) {
      setEditableTitle(dream?.title || '');
      setEditableTheme(dream?.theme || '');
      setEditableDreamType(dream?.dreamType || '');
      setEditableTranscript(dream?.transcript || '');
    }
    if (changedDream) {
      setIsEditing(false);
    }
  }, [dream, isEditing]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    const shownSub = Keyboard.addListener('keyboardDidShow', revealRecallInput);

    return () => {
      showSub.remove();
      hideSub.remove();
      shownSub.remove();
    };
  }, [revealRecallInput]);


  const { shareImageRef, shareComposite } = useDreamShareComposite();

  const analysisState = useMemo(() => getDreamAnalysisState(dream), [dream]);
  // Analyses, AI illustrations and conversations can be reported to us.
  const hasGeneratedContent = Boolean(dream && (analysisState.isAnalyzed
    || analysisState.hasModelResponse
    || (dream.imageUrl && dream.imageSource !== 'user')));
  const guestImageAvailable = useMemo(() => {
    if (quotaLoading) return false;
    const image = usage?.image;
    if (image) {
      return image.limit === null || image.used < image.limit;
    }
    return canGenerateImageNow;
  }, [canGenerateImageNow, quotaLoading, usage?.image]);
  const illustrationAccess = useMemo(
    () =>
      resolveJournalIllustrationAccess({
        tier,
        canGenerateImageNow: tier === 'guest' ? guestImageAvailable : canGenerateImageNow,
        isAnalyzed: analysisState.isAnalyzed,
        imageUrl: dream?.imageUrl,
        analysisRequestId: dream?.analysisRequestId,
      }),
    [
      analysisState.isAnalyzed,
      canGenerateImageNow,
      dream?.analysisRequestId,
      dream?.imageUrl,
      guestImageAvailable,
      tier,
    ]
  );
  const illustrationSidecar = useMemo(
    () =>
      resolveJournalIllustrationSidecar({
        imageUrl: dream?.imageUrl,
        imageGenerationFailed: dream?.imageGenerationFailed,
        imageJobStatus: dream?.imageJobStatus,
      }),
    [dream?.imageGenerationFailed, dream?.imageJobStatus, dream?.imageUrl]
  );
  const illustrationCta = useMemo(
    () =>
      resolveJournalIllustrationCta({
        sidecar: illustrationSidecar,
        isAnalyzed: analysisState.isAnalyzed,
        allowed: illustrationAccess.allowed,
        reason: illustrationAccess.reason,
        tier,
      }),
    [
      analysisState.isAnalyzed,
      illustrationAccess.allowed,
      illustrationAccess.reason,
      illustrationSidecar,
      tier,
    ]
  );
  const showCompletedReading = shouldShowCompletedJournalReading(
    dream?.analysisStatus,
    analysisState.isAnalyzed
  );
  const analysisFreshness = useMemo(() => getDreamAnalysisFreshness(dream), [dream]);
  const isAnalysisStale = analysisFreshness === 'stale';
  // Closed once for good: the next-step card below keeps offering the update.
  const [staleBannerDismissed, setStaleBannerDismissed] = useState(true);
  useEffect(() => {
    let active = true;
    getStaleAnalysisBannerDismissed()
      .then((dismissed) => { if (active) setStaleBannerDismissed(dismissed); })
      .catch(() => { if (active) setStaleBannerDismissed(false); });
    return () => { active = false; };
  }, []);
  const dismissStaleBanner = useCallback(() => {
    setStaleBannerDismissed(true);
    saveStaleAnalysisBannerDismissed(true).catch(() => {
      // Closed for this visit; it may reappear next time.
    });
  }, []);
  const visibleIllustrationCta =
    quotaLoading && illustrationCta === 'quota' ? 'none' : illustrationCta;
  const canOfferImageUpgrade = visibleIllustrationCta === 'upgrade';

  useEffect(() => {
    if (
      !dream ||
      !analysisState.isAnalyzed ||
      !dream.interpretation?.trim() ||
      trackedAnalysisResultRef.current === getDreamIdentityKey(dream)
    ) {
      return;
    }

    trackedAnalysisResultRef.current = getDreamIdentityKey(dream);
    const isOnboardingResult =
      onboardingState.pendingRecordingIntent?.savedDreamId === dream.id;

    void trackProductEvent('analysis_result_viewed', {
      source: isOnboardingResult ? 'recording_flow' : 'journal_detail',
    });
    storeReviewAfterLeaveRef.current = true;
    void recordStoreReviewAnalysisRead();
    if (onboardingState.completionReason === 'analyze') {
      void trackProductEvent(
        'first_value_viewed',
        buildFirstValueProperties(onboardingState, 'analysis_result')
      );
    }

    if (isOnboardingResult) {
      void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => {
        // The result remains visible and the persisted intent will be retried
        // safely on the next launch.
      });
    }
  }, [analysisState.isAnalyzed, dream, onboardingState, transitionOnboarding]);
  // Ask once the person leaves a reading they have just seen, not while reading it.
  useEffect(() => () => {
    if (storeReviewAfterLeaveRef.current) {
      void requestStoreReviewIfDue({ kind: 'analysis_read' });
    }
  }, []);
  const reflectionJourney = useMemo(
    () => getReflectionJourney(dream, analysisRecoveryClock, { tier }),
    [analysisRecoveryClock, dream, tier]
  );
  const primaryKind = reflectionJourney.primary.kind;
  const primaryAction = getJournalDetailPrimaryFamily(primaryKind);
  const isStalePrimaryAction = isAnalysisStale && !isEditing;
  const visiblePrimaryAction = isStalePrimaryAction ? 'analyze' : primaryAction;
  const quotaHint = useMemo(
    () =>
      getReflectionQuotaHint(
        isStalePrimaryAction ? 'analysis' : reflectionJourney.primary.consumesQuota,
        usage
      ),
    [isStalePrimaryAction, reflectionJourney.primary.consumesQuota, usage]
  );
  const formatQuotaHint = useCallback(
    (hint: ReflectionQuotaHint) => {
      if (hint.kind === 'none') return null;
      if (hint.kind === 'unlimited') {
        return t('journal.detail.quota_hint.unlimited');
      }
      const quotaKey = `journal.detail.quota_hint.quota.${hint.quota}` as const;
      if (hint.kind === 'remaining') {
        return t('journal.detail.quota_hint.remaining', {
          quota: t(quotaKey),
          remaining: hint.remaining,
        });
      }
      return t('journal.detail.quota_hint.unknown', { quota: t(quotaKey) });
    },
    [t]
  );
  const quotaHintLabel = quotaHint.kind === 'none' ? null
    : quotaLoading ? t('journal.detail.quota_hint.loading')
    : quotaHint.kind === 'remaining' && quotaHint.remaining <= 0
      ? t('journal.detail.quota_hint.empty')
      : formatQuotaHint(quotaHint);
  const canRecoverPendingAnalysis = useMemo(
    () => !isAnalyzing && isRecoverablePendingAnalysis(dream, analysisRecoveryClock),
    [analysisRecoveryClock, dream, isAnalyzing]
  );
  const isAnalysisPending = reflectionJourney.isPendingFresh && !isAnalyzing;
  const hasPurchasedAnalysisReturn = Boolean(dream && user && analysisOwnerId === user.id
    && hasPendingPurchasedAnalysisReturn(getDreamRouteParams(dream), user.id));
  const awaitingPurchasedAnalysis = analyzeAfterPurchase === '1' && hasPurchasedAnalysisReturn
    && Boolean(dream && !dream.isAnalyzed && dream.analysisStatus !== 'pending');
  const isPrimaryActionBusy = visiblePrimaryAction === 'analyze'
    && (awaitingPurchasedAnalysis || isAnalyzing || isAnalysisPending);
  const detailActionCard = useMemo(() => {
    if (!dream) {
      return null;
    }

    if (awaitingPurchasedAnalysis || isAnalyzing || isAnalysisPending) {
      return {
        icon: 'sparkles' as const,
        title: t('loading.analyzing'),
        message: t('journal.detail.action.pending.message'),
        step: t('journal.detail.action.pending.step'),
        cta: t('loading.analyzing'),
        disabled: true,
      };
    }

    if (isStalePrimaryAction) {
      return {
        icon: 'arrow.clockwise' as const,
        title: t('journal.detail.stale.label'),
        message: t('journal.detail.stale.banner'),
        step: t('journal.detail.action.analyze.step'),
        cta: t('journal.detail.stale.cta'),
        disabled: false,
      };
    }

    if (primaryAction === 'analyze') {
      if (user && savedAnalysisAction === 'upgrade' && !canResumeAnalysis) {
        return {
          icon: 'sparkles' as const,
          title: t('recording.saved_analysis.title'),
          message: t('journal.detail.analysis_exhausted'),
          step: t('journal.detail.action.analyze.step'),
          cta: t('journal.detail.analyze_with_plus'),
          disabled: false,
        };
      }
      if (guestNeedsAccount) {
        return {
          icon: 'person.fill' as const,
          title: t('recording.saved_analysis.title'),
          message: t(savedAnalysisAction === 'login'
            ? 'journal.detail.quota_limit.message_login'
            : 'recording.saved_analysis.guest_exhausted'),
          step: t('journal.detail.action.analyze.step'),
          cta: t(savedAnalysisAction === 'login'
            ? 'journal.detail.quota_limit.cta_login'
            : 'journal.detail.quota_limit.cta_guest'),
          disabled: false,
        };
      }
      const failed = dream.analysisStatus === 'failed' || canRecoverPendingAnalysis;
      return {
        icon: failed ? 'arrow.clockwise' as const : 'sparkles' as const,
        title: failed
          ? t('journal.detail.action.retry.title')
          : t('journal.detail.action.analyze.title'),
        message: failed
          ? t('journal.detail.action.retry.message')
          : t('journal.detail.action.analyze.message'),
        step: t('journal.detail.action.analyze.step'),
        cta: failed
          ? t('journal.detail.analyze_button.retry')
          : t('journal.detail.analyze_button.default'),
        disabled: false,
      };
    }

    if (primaryKind === 'retry_chat') {
      return {
        icon: 'arrow.clockwise' as const,
        title: t('journal.detail.action.retry_chat.title'),
        message: t('journal.detail.action.retry_chat.message'),
        step: t('journal.detail.action.continue.step'),
        cta: t('journal.detail.action.retry_chat.cta'),
        disabled: false,
      };
    }

    if (primaryAction === 'continue') {
      return {
        icon: 'bubble.left.and.bubble.right.fill' as const,
        title: t('journal.detail.action.continue.title'),
        message: t('journal.detail.action.continue.message'),
        step: t('journal.detail.action.continue.step'),
        cta: t('journal.detail.explore_button.continue'),
        disabled: false,
      };
    }

    return {
      icon: 'bubble.left.and.bubble.right' as const,
      title: t('journal.detail.action.explore.title'),
      message: t('journal.detail.action.explore.message'),
      step: t('journal.detail.action.explore.step'),
      cta: t('journal.detail.explore_button.new'),
      disabled: false,
    };
  }, [awaitingPurchasedAnalysis, canRecoverPendingAnalysis, canResumeAnalysis, dream, guestNeedsAccount, isAnalyzing, isAnalysisPending, isStalePrimaryAction, primaryAction, primaryKind, savedAnalysisAction, t, user]);
  const isAnalysisLaunchBlocked = !!dream && (isAnalysisPending || isAnalyzing);
  const isAnalysisLocked = isAnalysisLaunchBlocked || awaitingPurchasedAnalysis;
  // Act II of the dream story follows the dream's real state: waiting while an analysis
  // runs, then a reveal only when the reading lands while this screen watches. A dream
  // still marked pending keeps the story waiting even after the local request settles;
  // a reading saved before the request returns (sync and quota run after it) lands at once.
  const readingInFlight = isAnalysisLocked;
  const readingAwaited = readingInFlight && !showCompletedReading;
  const [readingStory, setReadingStory] = useState<'idle' | 'waiting' | 'revealed'>('idle');
  if (readingAwaited && readingStory !== 'waiting') {
    setReadingStory('waiting');
  } else if (!readingAwaited && readingStory === 'waiting') {
    setReadingStory(showCompletedReading ? 'revealed' : 'idle');
  }
  const savedMomentPhase: SavedDreamPhase = readingAwaited ? 'reading'
    : showCompletedReading ? 'read' : 'saved';
  const reducedMotion = useReducedMotion();
  const readingZoneTopRef = useRef<number | null>(null);
  const readingLayoutKey = dream?.analysisRequestId ?? `${dream?.id}:${dream?.analyzedAt ?? 0}`;
  const [interpretationLayout, setInterpretationLayout] = useState<{ key: string; top: number } | null>(null);
  const interpretationTop = interpretationLayout?.key === readingLayoutKey ? interpretationLayout.top : null;
  const readingRevealScrolledRef = useRef(false);
  const isImageJobPending = illustrationSidecar === 'pending';
  const isSyncPending = dreamSyncState === 'pending';
  const isSyncFailed = dreamSyncState === 'failed';
  const isSyncConflict = dreamSyncState === 'conflict';
  const shareMessage = useMemo(() => {
    if (!dream) return '';
    const sections: string[] = [];
    if (dream.title) {
      sections.push(`🌙 ${dream.title}`);
    }
    const quote = dream.shareableQuote?.trim();
    if (quote) {
      sections.push(`“${quote}”`);
      if (isPoeticDreamQuote(dream)) sections.push(t('journal.detail.quote_attribution'));
    }
    if (dream.interpretation?.trim()) {
      sections.push(
        `${t('journal.detail.share.interpretation_label')} ${dream.interpretation.trim()}`,
      );
    }
    const metadata: string[] = [];
    if (dream.dreamType) {
      metadata.push(t('journal.detail.share.type_label', { type: dreamTypeLabel || dream.dreamType }));
    }
    if (dream.theme) {
      metadata.push(
        t('journal.detail.share.theme_label', {
          theme: dreamThemeLabel || dream.theme,
        }),
      );
    }
    if (metadata.length) {
      sections.push(metadata.join(' • '));
    }
    sections.push(t('journal.detail.share.footer'));
    return sections.join('\n\n');
  }, [dream, dreamThemeLabel, dreamTypeLabel, t]);
  const shareTitle = useMemo(
    () => (dream?.title ? dream.title : t('journal.title')),
    [dream, t],
  );
  const shareImage = useMemo<ShareImageData | undefined>(() => {
    if (!dream) return undefined;
    const source = media.imageUrl || media.thumbnailUrl;
    if (!source) return undefined;
    const extension = getFileExtensionFromUrl(source);
    return {
      source,
      extension,
      mimeType: getMimeTypeFromExtension(extension),
    };
  }, [dream, media.imageUrl, media.thumbnailUrl]);
  // The share card's picture, as resolved for the page. Without one, the card goes without it.
  const shareSource = shareImage?.source ?? '';
  const [shareRequest, setShareRequest] = useState<ShareCompositeRequest | null>(null);
  const shareRequestIdRef = useRef(0);
  const pendingShareRef = useRef<PendingShareComposite | null>(null);
  const shareInFlightRef = useRef(false);
  const shareScreenMountedRef = useRef(true);
  const shareDreamIdentity = dream ? getDreamIdentityKey(dream) : undefined;
  const latestShareMediaRef = useRef({ source: shareSource, dreamIdentity: shareDreamIdentity });
  const onShareMediaReady = useCallback((requestId: number, source: string, ready: boolean) => {
    const pending = pendingShareRef.current;
    if (!pending || pending.id !== requestId || pending.source !== source) return;
    pendingShareRef.current = null;
    pending.resolve(ready && Boolean(shareImageRef.current) ? 'ready' : 'failed');
  }, [shareImageRef]);
  useLayoutEffect(() => {
    latestShareMediaRef.current = { source: shareSource, dreamIdentity: shareDreamIdentity };
    const pending = pendingShareRef.current;
    if (pending && (pending.source !== shareSource || pending.dreamIdentity !== shareDreamIdentity)) {
      pendingShareRef.current = null;
      pending.resolve('stale');
    }
  }, [shareSource, shareDreamIdentity]);
  useEffect(() => {
    shareScreenMountedRef.current = true;
    return () => {
      shareScreenMountedRef.current = false;
      const pending = pendingShareRef.current;
      pendingShareRef.current = null;
      pending?.resolve('stale');
    };
  }, []);
  const shareMediaPending = Platform.OS !== 'web' && Boolean(dream?.imageUrl || dream?.thumbnailUrl) && media.loading;
  const clipboardSupported = Platform.OS === 'web' && Boolean(getShareNavigator()?.clipboard?.writeText);

  // The page has one way to edit it: its name, details and story together.
  const startEditing = useCallback(() => {
    if (isAnalysisLocked) return;
    setHeldTitle(null);
    setIsEditing(true);
  }, [isAnalysisLocked]);

  const cancelEditing = useCallback(() => {
    Keyboard.dismiss();
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!dream) return;

    const normalizedTitle = editableTitle.trim() || dream.title;
    const normalizedTheme = editableTheme.trim() || dream.theme;
    const normalizedDreamType = editableDreamType.trim() || dream.dreamType;
    const normalizedTranscript = editableTranscript.trim().length === 0 ? dream.transcript : editableTranscript;
    Keyboard.dismiss();
    if (normalizedTitle === dream.title && normalizedTheme === dream.theme
      && normalizedDreamType === dream.dreamType && normalizedTranscript === dream.transcript) {
      setIsEditing(false);
      return;
    }

    const updatedDream: DreamAnalysis = {
      ...dream,
      title: normalizedTitle,
      // User can only meaningfully choose among the known themes/types today,
      // but we keep runtime flexible and trust persisted values here.
      theme: normalizedTheme as DreamAnalysis['theme'],
      dreamType: normalizedDreamType as DreamAnalysis['dreamType'],
      transcript: normalizedTranscript,
    };

    await updateDream(updatedDream);
    setIsEditing(false);
  }, [dream, editableTitle, editableTheme, editableDreamType, editableTranscript, updateDream]);

  const handlePickImage = useCallback(async () => {
    if (!dream || isAnalysisLocked) return;

    try {
      setIsPickingImage(true);
      const ImagePicker = await import('expo-image-picker');
      const allowCropInPicker = Platform.OS === 'android';
      const pickerQuality = allowCropInPicker ? 1 : 0.9;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: allowCropInPicker,
        ...(allowCropInPicker ? { aspect: [9, 16] as [number, number] } : {}),
        quality: pickerQuality,
        base64: Platform.OS === 'web',
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0] as PickedImageAsset | undefined;
      if (!asset) {
        return;
      }

      const croppedAsset = await cropDreamImageToAspect(
        asset,
        t('journal.detail.image.crop_error')
      );
      const selectedUri = Platform.OS === 'web' && croppedAsset.base64
        ? `data:${croppedAsset.mimeType ?? 'image/jpeg'};base64,${croppedAsset.base64}`
        : croppedAsset.uri;

      if (!selectedUri) {
        return;
      }

      const imageUpdatedAt = Date.now();
      const analysisRequestId = generateUUID();
      const updatedDream: DreamAnalysis = {
        ...dream,
        imageUrl: selectedUri,
        thumbnailUrl: selectedUri,
        imageGenerationFailed: false,
        imageUpdatedAt,
        analysisRequestId,
        imageSource: 'user',
      };

      await updateDream(updatedDream);
      setIsEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      Alert.alert(t('common.error_title'), msg);
    } finally {
      setIsPickingImage(false);
    }
  }, [dream, isAnalysisLocked, updateDream, t]);

  const openShareModal = useCallback(() => {
    setShareCopyStatus('idle');
    setShareModalVisible(true);
  }, []);
  const closeShareModal = useCallback(() => {
    setShareModalVisible(false);
    setShareCopyStatus('idle');
  }, []);
  const handleCopyShareText = useCallback(async () => {
    const webNavigator = getShareNavigator();
    if (!webNavigator?.clipboard?.writeText) {
      setShareCopyStatus('error');
      return;
    }
    try {
      await webNavigator.clipboard.writeText(shareMessage || '');
      setShareCopyStatus('success');
    } catch {
      setShareCopyStatus('error');
    }
  }, [shareMessage]);
  // Use full-resolution image config for detail view
  const imageConfig = useMemo(() => getImageConfig('full'), []);
  const imageVersion = useMemo(() => {
    if (!dream?.imageUrl) return undefined;
    return getDreamImageVersion(dream);
  }, [dream]);
  const imageCacheKey = dream?.imageUrl && imageVersion
    ? `${dream.imageUrl}|${imageVersion}`
    : undefined;
  const displayImageUrl = useMemo(() => {
    if (!dream?.imageUrl) return undefined;
    return media.imageUrl ? withCacheBuster(media.imageUrl, imageVersion) : undefined;
  }, [dream?.imageUrl, media.imageUrl, imageVersion]);

  const imageTraceKey = `image:${dream?.clientRequestId ?? dream?.id}`;
  useEffect(() => {
    if (dream?.imageUrl) markPerformance('image.reference_committed', { trace: performanceTraceId(imageTraceKey) });
  }, [dream?.imageUrl, imageTraceKey]);
  useEffect(() => {
    if (displayImageUrl) markPerformance('image.source_resolved', { trace: performanceTraceId(imageTraceKey) });
  }, [displayImageUrl, imageTraceKey]);
  const markImageDisplayed = useCallback(() => {
    markPerformance('image.native_displayed', { trace: performanceTraceId(imageTraceKey) });
  }, [imageTraceKey]);


  // Define callbacks before early return (hooks must be called unconditionally)
  const onShare = useCallback(async () => {
    if (!dream || isAnalysisLocked || shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    setIsSharing(true);
    try {
      if (Platform.OS === 'web') {
        const webNavigator = getShareNavigator();
        if (webNavigator?.share) {
          try {
            await webNavigator.share({ text: shareMessage, title: shareTitle });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              return;
            }
          }
        }
        openShareModal();
        return;
      }

      if (dream.imageUrl || dream.thumbnailUrl) {
        if (shareMediaPending || !shareDreamIdentity) return;

        const requestId = ++shareRequestIdRef.current;
        const source = shareSource;
        const preparation = await new Promise<SharePreparationStatus>(resolve => {
          pendingShareRef.current = { id: requestId, source, dreamIdentity: shareDreamIdentity, resolve };
          setShareRequest({
            id: requestId,
            source,
            dream,
            onMediaReady: (readySource, ready) => onShareMediaReady(requestId, readySource, ready),
          });
        });
        if (preparation === 'stale'
          || latestShareMediaRef.current.source !== source
          || latestShareMediaRef.current.dreamIdentity !== shareDreamIdentity) return;
        if (!shareImageRef.current) throw new Error('Dream share card is not mounted');

        // Mobile (iOS/Android): capture once the card is drawn, after its illustration is
        // displayed or, when that cannot be had or shown, without it.
        await shareComposite(dream);
        return;
      }

      // Fallback to text-only sharing if no image
      await Share.share({
        message: shareMessage,
        title: shareTitle,
      });
      return;
    } catch (error) {
      if (!shareScreenMountedRef.current) return;
      console.error('Share failed:', error);
      if (Platform.OS === 'web') {
        openShareModal();
      } else {
        Alert.alert(t('common.error_title'), t('journal.detail.share.error_message'));
      }
    } finally {
      pendingShareRef.current = null;
      shareInFlightRef.current = false;
      if (shareScreenMountedRef.current) {
        setShareRequest(null);
        setIsSharing(false);
      }
    }
  }, [dream, isAnalysisLocked, openShareModal, shareComposite, shareSource, shareMessage, shareTitle, t, shareMediaPending, shareDreamIdentity, shareImageRef, onShareMediaReady]);

  // Opened from a journal card's share icon: share once the dream is here, then drop the request.
  const autoShareDoneRef = useRef(false);
  useEffect(() => {
    if (shareParam !== '1' || !dream || autoShareDoneRef.current) return;
    autoShareDoneRef.current = true;
    router.setParams({ share: undefined });
    void onShare();
  }, [dream, onShare, shareParam]);

  const handleToggleFavorite = useCallback(async () => {
    if (!dream || isAnalysisLocked) return;
    try {
      setFavoriteError(null);
      await toggleFavorite(dream);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to toggle favorite', error);
      }
      setFavoriteError(t('journal.detail.favorite.error'));
    }
  }, [dream, isAnalysisLocked, toggleFavorite, t]);

  const handleRetrySync = useCallback(async () => {
    if (!dream) return;
    try {
      setSyncRetryFailed(false);
      setIsRetryingSync(true);
      await retryDreamSync(dream);
    } catch (error) {
      if (__DEV__) {
        console.warn('[JournalDetail] Failed to retry sync', error);
      }
      setSyncRetryFailed(true);
    } finally {
      setIsRetryingSync(false);
    }
  }, [dream, retryDreamSync]);

  const handleUseServerVersion = useCallback(async () => {
    if (!dream) return;
    await resolveDreamConflict(dream, 'use_server');
  }, [dream, resolveDreamConflict]);

  const handleKeepLocalVersion = useCallback(async () => {
    if (!dream) return;
    await resolveDreamConflict(dream, 'keep_local');
  }, [dream, resolveDreamConflict]);

  const deleteAndNavigate = useCallback(async () => {
    if (!dream) return;
    try {
      setIsDeleting(true);
      await deleteDream(dream);
      // One haptic, at the moment the dream is actually gone, in the same frame as the
      // sheet closing and the journal replacing this screen. Never the only feedback.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowDeleteSheet(false);
      router.replace('/(tabs)/journal');
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to delete dream', error);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(t('common.error_title'), t('common.unknown_error'));
      setIsDeleting(false);
    }
  }, [deleteDream, dream, t]);

  const handleCloseDeleteSheet = useCallback(() => {
    if (isDeleting) return;
    setShowDeleteSheet(false);
  }, [isDeleting]);

  const onDelete = useCallback(() => {
    if (!dream || isAnalysisLocked) return;
    setShowDeleteSheet(true);
  }, [dream, isAnalysisLocked]);

  // The reference lets us find the reported analysis, image or conversation.
  const onReportGeneratedContent = useCallback(() => {
    if (!dream) return;
    void openContactMail({
      subject: t('journal.detail.report.subject'),
      body: t('journal.detail.report.body', { reference: String(dream.remoteId ?? dream.clientRequestId ?? dream.id) }),
      unavailableTitle: t('journal.detail.report.button'),
      unavailableMessage: t('contact.mail_unavailable', { email: CONTACT_EMAIL }),
    });
  }, [dream, t]);

  const handleConfirmDelete = useCallback(() => {
    if (!dream || isAnalysisLocked || isDeleting) return;
    void deleteAndNavigate();
  }, [deleteAndNavigate, dream, isAnalysisLocked, isDeleting]);

  const onRetryImage = useCallback(async () => {
    if (!dream) return;
    setImageErrorCanRetry(true);
    setImageErrorNeedsSubscription(false);
    if (!illustrationAccess.allowed) {
      setImageErrorCanRetry(false);
      setImageErrorNeedsSubscription(Boolean(user));
      setImageErrorMessage(t('journal.detail.image.quota_exceeded_message'));
      return;
    }
    if (!(await requestAiConsent(t))) return;

    setIsRetryingImage(true);
    try {
      const sourceText = dream.transcript?.trim() || dream.interpretation?.trim();
      if (!sourceText) {
        throw new Error(t('journal.detail.image.no_source'));
      }

      await generateDreamImage(dream, {
        transcript: sourceText,
        previousImageUrl: dream.imageUrl || undefined,
        clientRequestId: illustrationAccess.bundledRequestId,
      });
    } catch (error) {
      if (error instanceof QuotaError) {
        setImageErrorCanRetry(false);
        setImageErrorNeedsSubscription(Boolean(user));
        setImageErrorMessage(t('journal.detail.image.quota_exceeded_message'));
        return;
      }
      const classified = classifyError(
        error instanceof Error ? error : new Error(t('common.unknown_error')),
        t
      );
      setImageErrorCanRetry(classified.canRetry);
      setImageErrorNeedsSubscription(classified.type === ErrorType.IMAGE_AUTHORIZATION);
      setImageErrorMessage(
        classified.userMessage === t('error.interpretation_limit')
          ? t('journal.detail.image.quota_exceeded_message')
          : classified.userMessage
      );
    } finally {
      setIsRetryingImage(false);
    }
  }, [dream, generateDreamImage, illustrationAccess.allowed, illustrationAccess.bundledRequestId, t, user]);

  const handleBackPress = useCallback(() => {
    // Epilogue: leaving a just-captured dream for the journal lets its card glow once there.
    if (dream && opensOnSavedMoment) markDreamStoryEpilogue(getDreamIdentityKey(dream));
    const pending = onboardingState.pendingRecordingIntent;
    if (dream && pending?.savedDreamId === dream.id && pending.phase === 'analysis_confirmation') {
      void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => {
        console.warn('[JournalDetail] Failed to dismiss the saved dream analysis choice');
      }).finally(() => router.dismissTo('/(tabs)/journal'));
      return;
    }
    // Reuse the journal beneath this detail, preserving its filters and scroll.
    // A direct link without that route still falls back to opening the journal.
    router.dismissTo('/(tabs)/journal');
  }, [dream, onboardingState.pendingRecordingIntent, opensOnSavedMoment, transitionOnboarding]);

  const handleJourneyPress = useCallback(() => {
    if (!dream) return;
    const href = buildReflectionResumeHref(dream, reflectionJourney.primary.resume);
    if (!href) {
      return;
    }
    router.push(href);
  }, [dream, reflectionJourney.primary.resume]);

  const showAnalysisNotice = useCallback(
    (title: string, message: string, tone: AnalysisNotice['tone'] = 'info') => {
      const notice = { title, message, tone };
      setLastAnalysisNotice(notice);
      setAnalysisNotice(notice);
    },
    []
  );

  const handleDismissAnalysisNotice = useCallback(() => {
    setAnalysisNotice(null);
  }, []);

  const handleDismissImageError = useCallback(() => {
    setImageErrorMessage(null);
  }, []);

  const handleRetryImageError = useCallback(() => {
    setImageErrorMessage(null);
    void onRetryImage();
  }, [onRetryImage]);

  const ensureAnalyzeAllowed = useCallback((): Promise<boolean> => {
    const knownAllowed = isPlus || (!quotaLoading && Boolean(usage?.analysis) && canAnalyzeNow);
    // The screen only reacts once the quota check has answered.
    return new Promise<boolean>((resolve) => resolve(knownAllowed || canAnalyze())).then((allowed) => {
      if (allowed) return true;
      if (quotaError || quotaStatus?.guestBootstrapStatus === 'degraded'
        || quotaStatus?.guestBootstrapStatus === 'disabled') {
        showAnalysisNotice(t('common.error_title'), t('journal.detail.quota_check_error'), 'error');
        return false;
      }
      // Don't show for paid users
      if (isPlus) return false;
      if (tier === 'free' && user && dream) {
        router.push(buildAnalysisPaywallHref(dream, user.id));
      } else if (!user) {
        router.push(quotaStatus?.isUpgraded
          ? '/settings?section=account&auth=signin' : '/settings?section=account&auth=signup');
      } else {
        setQuotaSheetMode(!user && quotaStatus?.isUpgraded ? 'login' : 'quota');
        setShowQuotaLimitSheet(true);
      }
      return false;
    }).catch((error: unknown) => {
      if (__DEV__) {
        console.error('[JournalDetail] Quota check failed:', error);
      }
      showAnalysisNotice(
        t('common.error_title'),
        t('journal.detail.quota_check_error'),
        'error'
      );
      return false;
    });
  }, [canAnalyze, canAnalyzeNow, dream, isPlus, quotaError, quotaLoading, quotaStatus, showAnalysisNotice, t, tier, usage, user]);

  const handleQuotaLimitDismiss = useCallback(() => {
    setShowQuotaLimitSheet(false);
  }, []);

  const handleQuotaLimitPrimary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    if (tier === 'guest') {
      router.push(quotaSheetMode === 'login'
        ? '/settings?section=account&auth=signin' : '/settings?section=account&auth=signup');
    } else {
      if (dream && user) router.push(buildAnalysisPaywallHref(dream, user.id));
    }
  }, [dream, quotaSheetMode, tier, user]);

  const handleQuotaLimitSecondary = useCallback(() => {
    setShowQuotaLimitSheet(false);
  }, []);

  const handleFirstValueBackup = useCallback(() => {
    router.push('/settings?section=account&auth=signup');
  }, []);

  const runAnalyze = useCallback(
    (replaceImage: boolean, skipAllowanceCheck = false): Promise<void> => {
      if (!dream || isAnalysisLaunchBlocked || analysisLaunchInFlightRef.current) return Promise.resolve();
      // Lock synchronously, including the asynchronous quota check and consent.
      analysisLaunchInFlightRef.current = true;
      const consented = skipAllowanceCheck || isResumableAnalysisRequest(dream)
        ? requestAiConsent(t)
        : ensureAnalyzeAllowed().then((allowed) => allowed && requestAiConsent(t));
      // Nothing on screen changes before the quota check and the consent prompt settle.
      return consented.then(async (granted) => {
        if (!granted) return;
        // Only now is anything being analysed: never show progress behind the consent prompt.
        setIsAnalyzing(true);

        const pending = onboardingState.pendingRecordingIntent;
        if (pending?.savedDreamId === dream.id && pending.phase === 'analysis_confirmation') {
          await transitionOnboarding({
            type: 'SET_PENDING_PHASE',
            phase: 'analysis_requested',
            savedDreamId: dream.id,
          });
        }

        setShowReplaceImageSheet(false);
        await analyzeDream(dream, dream.transcript, {
          replaceExistingImage: replaceImage,
          lang: language,
          analyticsSource: 'journal_detail',
        });
        setAnalysisNotice(null);
      }).catch((error: unknown) => {
        if (error instanceof QuotaError) {
          if (error.code === QuotaErrorCode.LOGIN_REQUIRED && tier === 'guest') {
            setQuotaSheetMode('login');
            setShowQuotaLimitSheet(true);
            return;
          }
          // Show quota limit sheet with upgrade CTA for non-paid users
          if (!isPlus) {
            if (tier === 'free' && user) {
              router.push(buildAnalysisPaywallHref(dream, user.id));
            } else {
              setQuotaSheetMode('quota');
              setShowQuotaLimitSheet(true);
            }
          } else {
            // Plus users should never hit quota errors, but show a notice if they do.
            showAnalysisNotice(
              t('common.error_title'),
              error.userMessage || t('common.unknown_error'),
              'error'
            );
          }
        } else {
          const classified = classifyError(error as Error, t);
          showAnalysisNotice(t('analysis_error.title'), classified.userMessage, 'error');
        }
      }).finally(() => {
        analysisLaunchInFlightRef.current = false;
        setIsAnalyzing(false);
      });
    },
    [
      analyzeDream,
      dream,
      ensureAnalyzeAllowed,
      isAnalysisLaunchBlocked,
      isPlus,
      language,
      onboardingState.pendingRecordingIntent,
      showAnalysisNotice,
      t,
      tier,
      transitionOnboarding,
      user,
    ]
  );

  useEffect(() => {
    if (autoAnalyzeParam !== '1' || autoAnalysisHandledRef.current) return;
    if (autoAnalysisExpiresAtRef.current === null) {
      autoAnalysisExpiresAtRef.current = Date.now() + GUEST_DEMO_QUOTA_WAIT_MS;
    }
    const remaining = autoAnalysisExpiresAtRef.current - Date.now();
    if (remaining <= 0) {
      autoAnalysisHandledRef.current = true;
      router.setParams({ autoAnalyze: undefined });
      return;
    }
    // A first guest session may be provisional while Play Integrity and the
    // remote quota settle. Keep the saved-dream intent briefly, never forever.
    const timeout = setTimeout(() => {
      if (autoAnalysisHandledRef.current) return;
      autoAnalysisHandledRef.current = true;
      router.setParams({ autoAnalyze: undefined });
    }, remaining);
    return () => clearTimeout(timeout);
  }, [autoAnalyzeParam]);

  useEffect(() => {
    if (analyzeAfterPurchase !== '1' || purchaseAnalysisHandledRef.current) return;
    // Wait for the verified subscription to reach this screen; never consume a
    // free credit while the purchase result is still propagating.
    if (!user || analysisOwnerId !== user.id || (dream && !hasPurchasedAnalysisReturn)) {
      purchaseAnalysisHandledRef.current = true;
      router.setParams({ analyzeAfterPurchase: undefined, analysisOwnerId: undefined });
      return;
    }
    if (!dream || !isPlus || quotaLoading) return;
    purchaseAnalysisHandledRef.current = true;
    router.setParams({ analyzeAfterPurchase: undefined, analysisOwnerId: undefined });
    if (consumePurchasedAnalysisReturn(getDreamRouteParams(dream), user.id)
      && !dream.isAnalyzed && dream.analysisStatus !== 'pending') {
      // Consume an external purchase-navigation event, guarded above to run once.
      void runAnalyze(!hasExistingImage);
    }
  }, [analysisOwnerId, analyzeAfterPurchase, dream, hasExistingImage, hasPurchasedAnalysisReturn, isPlus, quotaLoading, runAnalyze, user]);

  const handleAnalyze = useCallback(async () => {
    if (!dream || analysisPressInFlightRef.current) return;
    analysisPressInFlightRef.current = true;
    // The explicit tap owns the action if quota recovery happens concurrently.
    autoAnalysisHandledRef.current = true;
    if (autoAnalyzeParam === '1') router.setParams({ autoAnalyze: undefined });
    try {
      if (user && savedAnalysisAction === 'upgrade' && !canResumeAnalysis) {
        router.push(buildAnalysisPaywallHref(dream, user.id));
        return;
      }
      if (guestNeedsAccount) {
        router.push(savedAnalysisAction === 'login'
          ? '/settings?section=account&auth=signin' : '/settings?section=account&auth=signup');
        return;
      }

      if (!canResumeAnalysis) {
        const allowed = await ensureAnalyzeAllowed();
        if (!allowed) return;
      }

      if (hasExistingImage) {
        setShowReplaceImageSheet(true);
        return;
      }

      await runAnalyze(shouldReplaceExistingImage('first'), true);
    } finally {
      analysisPressInFlightRef.current = false;
    }
  }, [autoAnalyzeParam, canResumeAnalysis, dream, ensureAnalyzeAllowed, guestNeedsAccount, hasExistingImage, runAnalyze, savedAnalysisAction, user]);

  // Asked in the journal as the seal was struck, the reader chose to read the dream now: the
  // page takes the step the seal offers, as if pressed, once the allowance confirms it.
  useEffect(() => {
    if (autoAnalyzeParam !== '1' || autoAnalysisHandledRef.current || !dream) return;
    if (!isSavedArrival || recallRequested
      || dream.isAnalyzed || dream.analysisStatus !== 'none' || dream.analysisRequestId) {
      autoAnalysisHandledRef.current = true;
      router.setParams({ autoAnalyze: undefined });
      return;
    }
    // An unavailable credit can be a stale quota response during the first
    // guest bootstrap. Wait for a confirmed eligible response or the timeout.
    if (quotaLoading || savedAnalysisAction !== 'analyze') return;
    const timer = setTimeout(() => {
      if (autoAnalysisHandledRef.current) return;
      // A guest's reading comes with its illustration while one is still offered.
      if (!user && guestImageAvailable) {
        autoAnalysisHandledRef.current = true;
        router.setParams({ autoAnalyze: undefined });
        void runAnalyze(true);
        return;
      }
      void handleAnalyze();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoAnalyzeParam, dream, guestImageAvailable, handleAnalyze, isSavedArrival, quotaLoading, recallRequested,
    runAnalyze, savedAnalysisAction, user]);

  const handleReplaceImage = useCallback(() => {
    void runAnalyze(shouldReplaceExistingImage('replace'));
  }, [runAnalyze]);

  const handleKeepImage = useCallback(() => {
    void runAnalyze(shouldReplaceExistingImage('keep'));
  }, [runAnalyze]);

  const handleDismissReanalyzeSheet = useCallback(() => {
    setShowReanalyzeSheet(false);
    setReanalyzeImagePolicy('keep');
  }, []);

  const handleReanalyzeImagePolicyChange = useCallback((next: 'keep' | 'regenerate') => {
    setReanalyzeImagePolicy(next);
  }, []);

  const handleConfirmReanalyze = useCallback(() => {
    setShowReanalyzeSheet(false);
    void runAnalyze(
      shouldReplaceExistingImage(reanalyzeImagePolicy === 'regenerate' ? 'regenerate' : 'keep')
    );
  }, [reanalyzeImagePolicy, runAnalyze]);

  const handleStaleReanalyze = useCallback(() => {
    if (isAnalysisLocked) return;
    setReanalyzeImagePolicy('keep');
    setShowReanalyzeSheet(true);
  }, [isAnalysisLocked]);

  const handleDismissReplaceSheet = useCallback(() => {
    setShowReplaceImageSheet(false);
  }, []);

  const displayedAnalysisNotice = analysisNotice ?? lastAnalysisNotice;

  const keyboardBehavior: 'padding' | 'height' | undefined = Platform.select({
    ios: 'padding',
    android: 'height',
    default: undefined,
  });
  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 0, web: 0 }) ?? 0;
  const shouldHideHeroMedia = isKeyboardVisible && (isEditing);
  const coverImageFailed = Boolean((failedCoverUri && failedCoverUri === displayImageUrl) || (!displayImageUrl && media.error));
  const hasIllustratedCover = (artworkAtArrival === true || plateRevealed) && Boolean(dream?.imageUrl?.trim())
    && !shouldHideHeroMedia && !coverImageFailed;
  // Only the plate's picture drifts; without a plate its frame is never mounted.
  const coverParallax = useFrameParallax(hasIllustratedCover ? coverTravel : 0);
  useEffect(() => {
    if (readingStory === 'waiting') {
      readingRevealScrolledRef.current = false;
      return;
    }
    if (readingStory !== 'revealed' || readingRevealScrolledRef.current || interpretationTop === null) return;
    // The dock resizes as the reading lands, which re-runs this effect and cancels the
    // pending frame: only the frame that actually runs marks the reveal as handled.
    const frame = requestAnimationFrame(() => {
      readingRevealScrolledRef.current = true;
      const zoneTop = readingZoneTopRef.current;
      if (zoneTop == null) return;
      const top = zoneTop + interpretationTop;
      const visibleBottom = readingScrollOffset.get() + viewportHeight - actionDockHeight;
      // The reader asked for this reading: bring it into view when its first line lands below
      // the fold, never pull them back up from further down the page. The page stops at the
      // head of the reading, so the constellation that just lit stays on screen, and goes
      // further only as far as the first line needs to clear the dock.
      if (readingContentTop + top > visibleBottom - 120) {
        const readingHead = readingContentTop + zoneTop - 12;
        const firstLineClear = readingContentTop + top - (viewportHeight - actionDockHeight - 120);
        scrollViewRef.current?.scrollTo({ y: Math.max(readingHead, firstLineClear, 0), animated: !reducedMotion });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [actionDockHeight, interpretationTop, readingContentTop, readingScrollOffset, readingStory, reducedMotion, viewportHeight]);
  const pageReady = coverIntroHeight !== null && (!hasIllustratedCover || coverShown);
  useEffect(() => {
    if (pageReady) pageLaidOut();
  }, [pageLaidOut, pageReady]);
  const handoffTarget = useMemo(() => dream && ({ id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId }),
    [dream?.id, dream?.remoteId, dream?.clientRequestId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pageReady || !windowHandedOver || !handoffTarget) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => markDreamStoryPageReady(handoffTarget));
    });
    return () => cancelAnimationFrame(frame);
  }, [handoffTarget, pageReady, windowHandedOver]);
  const paintedArtwork = !coverImageFailed && displayImageUrl ? { uri: displayImageUrl, cacheKey: imageCacheKey } : null;
  // Act III keeps painting until the image can actually be shown: stored artwork is
  // saved on the dream before its signed URL resolves. Its landing plays once per visit,
  // even when an editor hides and remounts the illustration.
  const artworkResolving = Boolean(dream?.imageUrl?.trim()) && !paintedArtwork && !coverImageFailed;
  // Act III starts on the tap: a request in flight already paints, before the job reports.
  const paintingRequested = illustrationSidecar === 'pending' || (isRetryingImage && !dream?.imageUrl);
  const paintingInProgress = paintingRequested || (artworkAtArrival === false && artworkResolving);
  const [artworkLanded, setArtworkLanded] = useState(false);
  const artworkLanding = artworkAtArrival === false && Boolean(paintedArtwork) && !artworkLanded;
  useEffect(() => {
    if (!artworkLanding) return;
    const timer = setTimeout(() => setArtworkLanded(true), DREAM_STORY.paintSettle);
    return () => clearTimeout(timer);
  }, [artworkLanding]);
  const floatingTranscriptBottom = Platform.OS === 'ios' ? 32 : 24;
  const showSavedMoment = opensOnSavedMoment && !hasIllustratedCover && !shouldHideHeroMedia;

  // The arrival seals the dream: once the page has come in, the seal chooses among the four
  // signs and is struck with the dream's, then the name is written, unless the capture seal
  // already wrote it in the journal. Both wait a moment at most for a pre-analysis still on
  // its way; without it the seal stays plain and the page writes the name it has. Whichever
  // name it writes stays the dream's.
  const [naming, setNaming] = useState<{
    stage: 'waiting' | 'striking' | 'writing' | 'named';
    title?: string;
    seal?: SealMark | null;
    /** Struck by the capture seal, which named the dream too: the page shows both as left. */
    settled?: boolean;
  }>(() => {
    const sealed = windowHandedOver && dream ? getDreamStoryHandoffName(dream) : undefined;
    if (sealed) return { stage: 'named', title: sealed.title, seal: sealed.mark ?? null, settled: true };
    return { stage: opensOnSavedMoment ? 'waiting' : 'named' };
  });
  const [namingTime, setNamingTime] = useState<'early' | 'due' | 'late'>('early');
  const namingWaits = naming.stage === 'waiting';
  useEffect(() => {
    if (!namingWaits) return;
    const due = setTimeout(() => setNamingTime('due'), DREAM_STORY.namingFrom);
    // After the capture seal the pre-analysis has already been waited for; without it, the
    // page opens at the save and waits for it as long as the seal would have.
    const late = setTimeout(() => setNamingTime('late'),
      windowHandedOver ? DREAM_STORY.namingFrom + DREAM_STORY.namingHold : DREAM_STORY.nameDeadline);
    return () => { clearTimeout(due); clearTimeout(late); };
  }, [namingWaits, windowHandedOver]);
  // The name is taken as the dream has it at that moment, during render so nothing stale is written.
  if (namingWaits && dream && namingTime !== 'early' && (!initialCategorizationPending || namingTime === 'late')) {
    const legend = [dreamTypeLabel, dreamThemeLabel].filter(Boolean).join(' · ');
    const seal = dream.theme ? { theme: dream.theme, legend } : null;
    const title = dream.title || t('journal.detail.untitled_dream');
    setNaming({ stage: showSavedMoment ? 'striking' : windowHandedOver ? 'named' : 'writing', title, seal });
    if (!seal && !windowHandedOver) setHeldTitle(title);
  }
  const namedDream = useMemo(() => (naming.title && dream
    ? { id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId }
    : null
  ), [naming.title, dream?.id, dream?.remoteId, dream?.clientRequestId]); // eslint-disable-line react-hooks/exhaustive-deps
  const namedProvisionally = !naming.seal;
  useEffect(() => {
    if (namedDream) markDreamNamed(namedDream, namedProvisionally);
  }, [namedDream, namedProvisionally]);
  useEffect(() => {
    if (naming.stage !== 'striking') return;
    const timer = setTimeout(() => setNaming((current) => ({ ...current, stage: windowHandedOver ? 'named' : 'writing' })),
      reducedMotion ? 240 : naming.seal ? DREAM_STORY.sealStrike : DREAM_STORY.sealChoice);
    return () => clearTimeout(timer);
  }, [naming.seal, naming.stage, reducedMotion, windowHandedOver]);
  const sealing = useMemo(() => ({ mark: naming.seal ?? null, settled: naming.settled }), [naming.seal, naming.settled]);
  // A name changed meanwhile, by the reader's own hand, ends the ceremony: that name stands.
  const namingOn = naming.stage !== 'named'
    && (!naming.title || naming.title === (heldTitle ?? (dream?.title || t('journal.detail.untitled_dream'))));
  const captureTraceKey = dream ? `capture:${dream.clientRequestId ?? dream.id}` : undefined;
  useEffect(() => {
    if (!isSavedArrival || !captureTraceKey) return;
    markPerformance('journal.saved_page_committed', { trace: performanceTraceId(captureTraceKey) });
  }, [captureTraceKey, isSavedArrival]);
  useEffect(() => {
    if (!isSavedArrival || !captureTraceKey || namingOn) return;
    return markPerformanceAfterFrames('journal.saved_actions_reveal_elapsed',
      { trace: performanceTraceId(captureTraceKey), analysis_locked: isAnalysisLocked },
      opensOnSavedMoment && !windowHandedOver ? 120 + DURATION.normal : 0);
  }, [captureTraceKey, isAnalysisLocked, isSavedArrival, namingOn, opensOnSavedMoment, windowHandedOver]);
  const finishNaming = useCallback(() => {
    setNaming((current) => (current.stage === 'writing' ? { ...current, stage: 'named' } : current));
  }, []);

  // The seal, under the name and before the story, at the head of the reading: from the
  // capture on arrival, and on every page whose dream is being or has been read.
  const readingBegun = readingInFlight || showCompletedReading;
  const sealVisible = !shouldHideHeroMedia && (opensOnSavedMoment || readingBegun);
  // On a page opened again, the seal bears the dream's type and theme as its reading left them.
  const sealTheme = dream?.theme;
  const sealDreamType = dream?.dreamType;
  const pageSeal = useMemo(() => {
    if (!sealTheme || !(sealTheme in SEAL_EMBLEMS)) return null;
    const typed = sealDreamType && (analysisState.isAnalyzed || sealDreamType !== 'Symbolic Dream');
    const legend = [typed ? dreamTypeLabel : null, dreamThemeLabel].filter(Boolean).join(' · ');
    return { mark: { theme: sealTheme, legend }, settled: true };
  }, [analysisState.isAnalyzed, sealDreamType, sealTheme, dreamThemeLabel, dreamTypeLabel]);
  const sealShows = opensOnSavedMoment ? (naming.stage === 'waiting' ? null : sealing) : pageSeal;
  // The seal's rim carries the dream's details, which the name then leaves to it.
  const detailsOnSeal = sealVisible && Boolean(sealShows?.mark);

  // The illustration waits in the seal until the reading has landed and the seal is in
  // sight, then flies out to become the page's plate.
  const sealHoldsArtwork = sealVisible && artworkAtArrival === false && Boolean(paintedArtwork) && artworkLanded
    && !plateRevealed && !readingInFlight;
  const releaseArtwork = useCallback(() => {
    const seal = sealWindowRef.current;
    if (!seal || coverFlight || isEditing || isIllustrationFullscreen) return;
    seal.measureInWindow((x, y, sealWidth) => {
      const centre = { x: x + sealWidth / 2, y: y + SEAL_MEASURES.orbit / 2 };
      if (centre.y < insets.top + 24 || centre.y > viewportHeight - 96) return;
      if (reducedMotion) {
        revealPlate();
        return;
      }
      // The plate takes the place of the running head and the name, above the reading,
      // which stays where the reader has it: on the screen it ends just above the reading.
      const top = readingContentTop - readingScrollOffset.get() - coverHeight;
      // As the page lays its picture out there, drifted for its place on the screen.
      const place = (top + coverHeight / 2 - windowSize.height / 2) / (windowSize.height / 2 + coverHeight / 2);
      const drift = reducedMotion ? 0 : -coverTravel * Math.max(-1, Math.min(1, place));
      setCoverFlight({ from: { ...centre, size: SEAL_MEASURES.medallion }, to: { top, drift }, landed: false });
    });
  }, [coverFlight, coverHeight, coverTravel, insets.top, isEditing, isIllustrationFullscreen, readingContentTop, readingScrollOffset, reducedMotion,
    revealPlate, viewportHeight, windowSize.height]);
  useEffect(() => {
    if (!sealHoldsArtwork) return;
    const frame = requestAnimationFrame(releaseArtwork);
    return () => cancelAnimationFrame(frame);
  }, [releaseArtwork, sealHoldsArtwork]);
  const scrollRestRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (scrollRestRef.current) clearTimeout(scrollRestRef.current);
  }, []);
  const coverFlightArrived = revealPlate;
  const coverFlightGone = useCallback(() => setCoverFlight(null), []);
  // While the seal holds the illustration, while it flies and as the plate settles in.
  const holdsReading = sealHoldsArtwork || Boolean(coverFlight) || plateSettling;
  // The web has no maintainVisibleContentPosition, and its layout events follow sizes only,
  // so a reading moved by the plate (coming in, or resized by a rotation) keeps a stale top.
  // After each commit, before the browser paints, its top is read again; while the plate
  // comes in above, the page scrolls by as much, leaving the reading where the reader has it.
  const readingPlaceRef = useRef<number | null>(null);
  // Every commit, on purpose: any of them may move the reading. A top that did not move sets nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const place = (readingContentRef.current as unknown as HTMLElement | null)?.offsetTop ?? null;
    const previous = readingPlaceRef.current;
    readingPlaceRef.current = place;
    if (place === null || place === previous) return;
    setReadingContentTop(place);
    if (!holdsReading || previous === null) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, readingScrollOffset.get() + place - previous), animated: false });
  });
  // The flight fades once the plate shows under it, or after a moment at most.
  const plateUnderFlight = plateRevealed && Boolean(coverFlight) && !coverFlight?.landed;
  useEffect(() => {
    if (!plateUnderFlight) return;
    const landed = () => setCoverFlight((current) => (current ? { ...current, landed: true } : current));
    if (coverShown) {
      const frame = requestAnimationFrame(landed);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(landed, 700);
    return () => clearTimeout(timer);
  }, [coverShown, plateUnderFlight]);

  if (!dream) {
    return (
      <View className="relative flex-1 overflow-hidden bg-ink">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <View className="flex-1 items-center justify-center p-5">
            <Text className="text-[18px] text-ivory">
              {t('journal.detail.not_found.title')}
            </Text>
            {!user ? (
              <SignInToOpenDream destination={dreamAuthReturnDestination('journal', { id, remoteId, clientRequestId })} />
            ) : null}
            <PressableScale
              onPress={handleBackPress}
              className="mt-4 rounded-sm bg-champagne px-6 py-3"
            >
              <Text className="font-sans-bold text-[16px] text-on-champagne">
                {t('journal.detail.not_found.back')}
              </Text>
            </PressableScale>
          </View>
          {savedConfirmationVisible ? (
            <Toast
              message={t('recording.save.confirmation')}
              mode="success"
              onHide={() => setSavedConfirmationVisible(false)}
              testID={TID.Text.RecordingSaveConfirmation}
            />
          ) : null}
        </KeyboardAvoidingView>
      </View>
    );
  }

  const renderTranscriptBody = () => (
    <View
      testID={TID.Component.TranscriptCard}
      className="font-sans text-[15px] leading-6"
    >
      <BookSectionMark key={`story-heading-${windowSize.fontScale}`} label={t('journal.original_transcript')}
        testID={TID.Text.DreamDetailDreamZone} scale={compactTextScale} className="mb-5" />
      {isEditing && hasUncategorizedDraft && initialCategorizationPending ? (
        <Text testID="text.dreamMetadata.pending" accessibilityLiveRegion="polite" className="mb-4 font-sans text-[13px] text-ivory-muted">
          {t('journal.detail.metadata.loading')}
        </Text>
      ) : null}
      {isEditing ? (
        <TextInput
          testID={TID.Input.DreamTranscript}
          className="min-h-[140px] rounded-md border border-line bg-ink-active p-3 font-sans text-[15px] leading-[22px] text-ivory"
          multiline
          style={{ maxHeight: Math.max(160, windowSize.height * 0.36) }}
          value={editableTranscript}
          onChangeText={setEditableTranscript}
          onFocus={() => { editingStoryRef.current = true; }}
          onBlur={() => { editingStoryRef.current = false; }}
          placeholder={t('recording.placeholder.accessibility')}
          accessibilityLabel={t('recording.placeholder.accessibility')}
          placeholderTextColor={noctalia.text.secondary}
          selectionColor={noctalia.accent.base}
          textAlignVertical="top"
        />
      ) : (
        <BookProse text={dream.transcript} />
      )}
      {dream.captureOriginalTranscript ? <CaptureOriginal source={dream.captureOriginalTranscript} /> : null}
    </View>
  );

  // The dream's type and theme, under its name as a book sets a subtitle: in italics, a star between them.
  const renderMetadataChips = () => {
    const typeShown = Boolean(dream.dreamType && (analysisState.isAnalyzed || dream.dreamType !== 'Symbolic Dream'));
    return (
      <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-2">
        {typeShown ? (
          <Text key={`dream-type-${windowSize.fontScale}`} allowFontScaling={false} style={metadataTextStyle} className="max-w-full shrink font-serif-italic text-[14px] text-ivory-muted">{dreamTypeLabel || dream.dreamType}</Text>
        ) : null}
        {typeShown && dreamThemeLabel ? <BookStar size={3} opacity={0.7} /> : null}
        {dreamThemeLabel ? (
          <Text key={`dream-theme-${windowSize.fontScale}`} allowFontScaling={false} style={metadataTextStyle} className="max-w-full shrink font-serif-italic text-[14px] text-ivory-muted">{dreamThemeLabel}</Text>
        ) : (
          <Pressable onPress={startEditing} disabled={isAnalysisLocked} accessibilityRole="button"
            className={`min-h-[44px] max-w-full justify-center ${isAnalysisLocked ? 'opacity-70' : ''}`}>
            <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
              <IconSymbol name="paintpalette" size={14} color={noctalia.accent.text} />
              <Text className="shrink font-sans-medium text-[13px] text-champagne-on">{t('journal.detail.theme_placeholder')}</Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  };

  const renderMetadataCard = (variant: 'inline' | 'floating' = 'inline') => {
    const compactMetadata = variant === 'inline' && !isEditing;
    // The main content card and its inner accent cards share one surface colour so the
    // padding around them doesn't read as a darker band on Android.
    const borderClassName = variant === 'floating'
      ? 'border border-line'
      : 'border-0 border-line-strong';

    return (
      <View
        testID={TID.Component.MetadataCard}
        style={compactMetadata ? undefined : variant === 'floating' ? shadows.xl : shadows.md}
        className={[
          // On arrival the story follows the title closely; the chips wait below it.
          compactMetadata ? `mx-2 ${opensOnSavedMoment || sealVisible ? 'mb-1' : 'mb-7'}` : 'mb-6 rounded-t-xl rounded-b-lg px-5 pt-5 bg-ink-raised',
          compactMetadata ? '' : borderClassName,
          compactMetadata ? '' : 'pb-5',
          variant === 'floating' ? 'rounded-[20px]' : '',
        ].join(' ')}
      >
      <>
          {isEditing ? (
            <TextInput
              testID={TID.Input.DreamTitle}
              nativeID={TID.Input.DreamTitle}
              className="mb-3 border-b border-line pb-1 font-serif-bold text-[24px] leading-8 text-ivory"
              selectTextOnFocus
              value={editableTitle}
              onChangeText={setEditableTitle}
              placeholder={t('journal.detail.title_placeholder')}
              accessibilityLabel={t('journal.detail.title_placeholder')}
              placeholderTextColor={noctalia.text.secondary}
              selectionColor={noctalia.accent.base}
            />
          ) : (
            // Above its seal, the name keeps the same lines whatever its length, so the seal
            // lies at the same place on every page.
            <View style={compactMetadata && sealVisible && !hasIllustratedCover
              ? { minHeight: SEAL_NAME_LINES * 32 * titleTextScale + 8 } : undefined}>
          {namingOn && !windowHandedOver ? (
            <View className="mb-2">
              <WrittenTitle key={`dream-heading-${windowSize.fontScale}`}
                text={naming.title ?? (dream.title || t('journal.detail.untitled_dream'))}
                writing={naming.stage === 'writing'} onWritten={finishNaming} lineHeight={32 * titleTextScale}
                style={{ fontSize: 26 * titleTextScale, lineHeight: 32 * titleTextScale }}
                className="font-display-semibold text-[26px] leading-8 text-ivory" />
            </View>
          ) : (
            <Text key={`dream-heading-${windowSize.fontScale}`} allowFontScaling={false} style={{ fontSize: 26 * titleTextScale, lineHeight: 32 * titleTextScale }} accessibilityRole="header" className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
              {heldTitle ?? (dream.title || t('journal.detail.untitled_dream'))}
            </Text>
          )}
            </View>
          )}
          {/* The date, unless the seal's rim carries it. */}
          {compactMetadata && sealVisible ? null : (
            <View className={`${opensOnSavedMoment ? 'mb-2' : 'mb-5'} flex-row items-center justify-between gap-3`}>
              <Text key={`dream-date-${windowSize.fontScale}`} allowFontScaling={false} style={{ fontSize: 13 * compactTextScale, lineHeight: 20 * compactTextScale }} className="shrink font-serif-italic text-[13px] leading-5 text-ivory-muted">
                {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
              </Text>
            </View>
          )}
          {!isEditing && hasUncategorizedDraft && initialCategorizationPending ? (
            <Text testID="text.dreamMetadata.pending" accessibilityLiveRegion="polite" className="mb-4 font-sans text-[13px] text-ivory-muted">
              {t('journal.detail.metadata.loading')}
            </Text>
          ) : null}
          {!isEditing && needsMetadataRecovery ? (
            <View className="mb-2 gap-1">
              <Pressable onPress={recoverMetadata} disabled={isRecoveringMetadata}
                accessibilityRole="button" accessibilityState={{ disabled: isRecoveringMetadata, busy: isRecoveringMetadata }}
                className="min-h-[44px] justify-center self-start"
                testID="dream-metadata-retry">
                <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                  {isRecoveringMetadata
                    ? <ActivityIndicator size="small" color={noctalia.accent.text} />
                    : <IconSymbol name="arrow.clockwise" size={14} color={noctalia.accent.text} />}
                  <Text className="shrink font-sans-medium text-[13px] text-champagne-on">
                    {t(isRecoveringMetadata ? 'journal.detail.metadata.loading' : 'journal.detail.metadata.retry')}
                  </Text>
                </View>
              </Pressable>
              {metadataRecoveryFailed ? <Text accessibilityRole="alert" className="font-sans text-[13px] text-ivory-muted">
                {t('journal.detail.metadata.error')}
              </Text> : null}
            </View>
          ) : null}
      </>

      {compactMetadata ? (
        opensOnSavedMoment || detailsOnSeal ? null : renderMetadataChips()
      ) : <>
      {(isEditing || (dream.dreamType && (analysisState.isAnalyzed || dream.dreamType !== 'Symbolic Dream'))) && (
        <View className={`mt-2 flex-row gap-2 ${isEditing ? 'items-start' : 'items-center'}`}
        >
          <IconSymbol name="moon.stars.fill" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
          <Text className={`font-sans-medium text-[14px] text-ivory opacity-70 ${isEditing ? 'mt-1' : ''}`}>{t('journal.detail.dream_type_label')}</Text>
          {isEditing ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
              <View className="flex-row gap-2 py-0.5">
                {sortedDreamTypes.map((type) => {
                  const label = getDreamTypeLabel(type as DreamType, t) ?? type;
                  const selected = editableDreamType === type;
                  return (
                    <Pressable
                      key={type}
                      testID={`chip.type.${type}`}
                      onPress={() => setEditableDreamType(type)}
                      className={`rounded-[20px] border px-3 py-1.5 ${
                        selected ? 'border-champagne-soft bg-champagne' : 'border-line'
                      }`}
                    >
                      <Text
                        className={`text-[12px] capitalize ${
                          selected ? 'font-sans-bold text-on-champagne' : 'font-sans-medium text-ivory'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text className="flex-1 font-sans-bold text-[14px] capitalize text-ivory">
              {dreamTypeLabel || dream.dreamType}
            </Text>
          )}
        </View>
      )}

      <View className={`mt-2 flex-row gap-2 ${isEditing ? 'items-start' : 'items-center'}`}>
        <IconSymbol name="paintpalette" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
        <Text className={`font-sans-medium text-[14px] text-ivory opacity-70 ${isEditing ? 'mt-1' : ''}`}>{t('journal.detail.theme_label')}</Text>
        {isEditing ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
            <View className="flex-row gap-2 py-0.5">
              {sortedDreamThemes.map((theme) => {
                const label = getDreamThemeLabel(theme as DreamTheme, t) ?? theme;
                const selected = editableTheme === theme;
                return (
                  <Pressable
                    key={theme}
                    testID={`chip.theme.${theme}`}
                    onPress={() => setEditableTheme(theme)}
                    className={`rounded-[20px] border px-3 py-1.5 ${
                      selected ? 'border-champagne-soft bg-champagne' : 'border-line'
                    }`}
                  >
                    <Text
                      className={`text-[12px] capitalize ${
                        selected ? 'font-sans-bold text-on-champagne' : 'font-sans-medium text-ivory'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          dreamThemeLabel ? (
            <Text className="flex-1 font-sans-bold text-[14px] text-ivory">{dreamThemeLabel}</Text>
          ) : (
            <Pressable onPress={startEditing} disabled={isAnalysisLocked}
              accessibilityRole="button" className="min-h-[44px] flex-1 justify-center">
              <Text className={`font-sans-medium text-[14px] text-champagne-on underline`}>{t('journal.detail.theme_placeholder')}</Text>
            </Pressable>
          )
        )}
      </View>
      </>}

    </View>
  );
  };

  const renderSyncStatusCard = () => {
    if (!dream || dreamSyncState === 'clean') {
      return null;
    }

    const title = isSyncConflict
      ? t('journal.detail.sync.conflict_title')
      : isSyncFailed
        ? t('journal.detail.sync.failed_title')
        : t('journal.detail.sync.pending_title');
    const message = isSyncConflict
      ? (dream.lastSyncError && !isTechnicalRevisionConflict(dream.lastSyncError)
          ? dream.lastSyncError
          : t('journal.detail.sync.conflict_message'))
      : isSyncFailed
        ? (dream.lastSyncError || t('journal.detail.sync.failed_message'))
        : t('journal.detail.sync.pending_message');
    // Icon colours go to a prop, not a style, so they stay on the TS tokens.
    const toneIconColor = isSyncConflict
      ? noctalia.status.danger.icon
      : isSyncFailed
        ? noctalia.status.warning.icon
        : noctalia.accent.text;
    const cardToneClassName = isSyncConflict
      ? 'bg-danger border-danger-line'
      : isSyncFailed
        ? 'bg-warning border-warning-line'
        : 'bg-ink-active border-line';
    const titleToneClassName = isSyncConflict
      ? 'text-danger-on'
      : isSyncFailed
        ? 'text-warning-on'
        : 'text-ivory';
    const messageToneClassName = isSyncConflict
      ? 'text-danger-on'
      : isSyncFailed
        ? 'text-warning-on'
        : 'text-ivory-muted';
    const iconName = isSyncConflict
      ? 'exclamationmark.octagon.fill'
      : isSyncFailed
        ? 'exclamationmark.triangle.fill'
        : 'arrow.triangle.2.circlepath';

    return (
      <View className={`mb-4 rounded-lg border p-6 ${cardToneClassName}`}>
        <View className="mb-3 flex-row items-center gap-3">
          <IconSymbol name={iconName} size={24} color={toneIconColor} />
          <Text className={`flex-1 font-serif-bold text-[22px] ${titleToneClassName}`}>{title}</Text>
        </View>
        <Text className={`mb-5 font-sans text-[15px] leading-[22px] ${messageToneClassName}`}>{message}</Text>
        {syncRetryFailed ? (
          <Text accessibilityRole="alert" className="mb-4 font-sans text-[15px] text-ivory-muted">
            {t('journal.detail.sync.retry_error')}
          </Text>
        ) : null}
        {isSyncPending || isSyncFailed ? (
          <PressableScale
            className="mb-4 flex-row items-center justify-center gap-2.5 rounded-md bg-champagne p-4"
            onPress={handleRetrySync}
            disabled={isRetryingSync}
            accessibilityState={{ disabled: isRetryingSync }}
          >
            {isRetryingSync ? (
              <ActivityIndicator size="small" color={noctalia.action.primaryText} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={18} color={noctalia.action.primaryText} />
            )}
            <Text className="font-sans-bold text-[16px] text-on-champagne">
              {t('journal.detail.sync.retry')}
            </Text>
          </PressableScale>
        ) : null}
        {isSyncConflict ? (
          <View className="mt-2 flex-row gap-3">
            <PressableScale
              className="flex-1 items-center justify-center rounded-[14px] bg-danger-icon py-3.5"
              onPress={handleKeepLocalVersion}
            >
              <Text className="font-sans-bold text-[15px] text-on-champagne">
                {t('journal.detail.sync.keep_local')}
              </Text>
            </PressableScale>
            <PressableScale
              className="flex-1 items-center justify-center rounded-[14px] border border-danger-line py-3.5"
              onPress={handleUseServerVersion}
            >
              <Text className="font-sans-bold text-[15px] text-danger-on">
                {t('journal.detail.sync.use_server')}
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
    );
  };

  // While allowances load, keep the regular card so it does not reflow under the user's thumb.
  const analysisAccessLabel = visiblePrimaryAction !== 'analyze' || quotaLoading || isPrimaryActionBusy || canResumeAnalysis || guestNeedsAccount || savedAnalysisAction === 'upgrade' ? null
    : quotaHint.kind === 'unknown' ? t('journal.detail.check_analysis')
      : quotaHint.kind === 'remaining' && quotaHint.remaining <= 0
        ? t('journal.detail.analysis_options') : null;

  const renderQuotaHint = (align: 'start' | 'center' = 'start') => {
    if (!quotaHintLabel || canResumeAnalysis) {
      return null;
    }
    return (
      <Text
        className={`font-sans text-[12px] leading-[16px] text-ivory-muted ${align === 'center' ? 'text-center' : ''}`}
        testID={TID.Text.DreamDetailQuotaHint}
        accessibilityLiveRegion="polite"
      >
        {quotaHintLabel}
      </Text>
    );
  };

  // The page's next step, as the dock and, after a capture, the seal both offer it.
  const primaryDisabled = !detailActionCard || detailActionCard.disabled || isPrimaryActionBusy || isAnalysisLocked;
  const primaryPress = isStalePrimaryAction
    ? handleStaleReanalyze
    : visiblePrimaryAction === 'analyze'
      ? handleAnalyze
      : handleJourneyPress;
  const primaryButtonTestID = isStalePrimaryAction
    ? TID.Button.AnalysisStaleCta
    : TID.Button.DreamDetailPrimaryCta;
  const analysisIcon = guestNeedsAccount ? 'person.fill' : visiblePrimaryAction === 'analyze'
    ? (isStalePrimaryAction ? 'arrow.clockwise' : 'sparkles') : 'arrow.right';
  // The saved moment already confirms the save; only a message explaining the offer remains.
  const arrivalMessage = !detailActionCard || analysisAccessLabel
    || detailActionCard.message === t('journal.detail.action.analyze.message') ? null : detailActionCard.message;
  // After a capture the struck seal offers the dream's reading itself, then shows it read.
  const sealReads = sealVisible && isSavedArrival && !isStalePrimaryAction && Boolean(detailActionCard)
    && (visiblePrimaryAction === 'analyze' || readingInFlight);
  // Whatever page it is on, the seal says while the dream is being read; the dock need not.
  const sealShowsReading = sealVisible && readingInFlight;
  // Once read, the seal offers the dream's illustration, which it then paints in its own window.
  // Asked there, it keeps its words while it paints, so the seal stays the same button meanwhile.
  const sealSettled = sealVisible && !readingInFlight && !sealReads;
  const sealPaints = sealSettled && illustrationAskedOnSeal && paintingInProgress && !plateRevealed;
  // Only a dream with no illustration yet: a failed one keeps its own card and its own step.
  const sealIllustrates = sealSettled && illustrationSidecar === 'empty' && !paintingInProgress
    && (visibleIllustrationCta === 'illustrate' || visibleIllustrationCta === 'upgrade');
  const sealAction: SavedDreamAction | null = !sealVisible ? null
    : readingInFlight ? { label: t('loading.analyzing') }
      : sealPaints ? {
        label: t('analysis.reading.image_generating'),
        icon: 'sparkles',
        onPress: () => {},
        disabled: true,
        testID: TID.Button.JournalIllustrate,
        emphasis: 'secondary',
      }
        : sealIllustrates ? (visibleIllustrationCta === 'upgrade' ? {
          label: t('journal.detail.image.seal_upgrade'),
          icon: 'sparkles',
          onPress: handleImageUpgrade,
          hint: t('journal.detail.image.upgrade_action'),
          testID: TID.Button.ImageUpgrade,
          emphasis: 'secondary',
        } : {
          label: t('journal.detail.image.generate_action'),
          icon: 'sparkles',
          onPress: () => {
            setIllustrationAskedOnSeal(true);
            void onRetryImage();
          },
          disabled: isRetryingImage || isImageJobPending,
          testID: TID.Button.JournalIllustrate,
          emphasis: 'secondary',
        })
          : !sealReads || !detailActionCard ? null : {
            label: analysisAccessLabel ?? detailActionCard.cta,
            icon: analysisIcon,
            onPress: primaryPress,
            disabled: primaryDisabled,
            hint: quotaHintLabel,
            testID: primaryButtonTestID,
            emphasis: 'primary',
          };

  const renderReturnToJournal = (quiet: boolean) => (
    <PressableScale accessibilityRole="button" onPress={handleBackPress}
      testID="btn.savedDream.returnToJournal"
      className={quiet
        ? 'min-h-[44px] items-center justify-center px-4'
        : 'min-h-[48px] items-center justify-center rounded-md border border-line-strong px-4 py-2.5'}>
      <Text className={quiet
        ? 'font-sans-medium text-[15px] text-ivory'
        : 'font-sans-medium text-[16px] text-ivory'}>
        {t('journal.detail.saved.return')}
      </Text>
    </PressableScale>
  );

  const renderDetailActionCard = (
    visibleFamilies?: ('analyze' | 'explore' | 'continue')[]
  ) => {
    if (!detailActionCard || isEditing) {
      return null;
    }
    if (visibleFamilies && !visibleFamilies.includes(visiblePrimaryAction)) {
      return null;
    }
    // On a page opened again, the seal shows the reading under way on its own.
    if (sealShowsReading && !isSavedArrival) {
      return null;
    }
    // The seal offers the reading, or shows it under way: the dock keeps the offer's one
    // caption (why it is what it is, otherwise the allowance) and leads back.
    if (sealReads) {
      const caption = readingInFlight ? null
        : arrivalMessage ? (
          <Text testID={TID.Text.DreamDetailActionMessage}
            className="text-center font-sans text-[12px] leading-[17px] text-ivory-muted">
            {arrivalMessage}
          </Text>
        ) : guestNeedsAccount ? null : renderQuotaHint('center');
      return (
        <View testID={TID.Component.DreamDetailActionCard} className="gap-1">
          {caption ? <View className="px-2">{caption}</View> : null}
          {renderReturnToJournal(true)}
        </View>
      );
    }

    if (awaitingPurchasedAnalysis || isAnalyzing || isAnalysisPending) {
      return (
        <View
          testID={TID.Component.DreamDetailActionCard}
          accessibilityLiveRegion="polite"
          className="min-h-[52px] flex-row items-center gap-3 rounded-xl bg-ink-active p-4"
        >
          {/* Act II's waiting stars, the same signal the medallion and the reading show. */}
          <WaitingStars count={3} compact />
          <Text
            allowFontScaling={false}
            style={{ fontSize: 16 * compactTextScale, lineHeight: 24 * compactTextScale }}
            testID={TID.Text.DreamDetailActionTitle}
            className="flex-1 font-sans-bold text-[16px] text-ivory"
          >
            {t('loading.analyzing')}
          </Text>
        </View>
      );
    }

    const disabled = primaryDisabled;
    const onPress = primaryPress;
    const isCompactExplorationAction =
      !isStalePrimaryAction &&
      (visiblePrimaryAction === 'continue' || visiblePrimaryAction === 'explore');

    if (isCompactExplorationAction) {
      return (
        <View className="gap-2">
          <PressableScale testID={TID.Component.DreamDetailActionCard} onPress={onPress}
            disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
            accessibilityHint={quotaHintLabel ?? undefined}
            className={`min-h-[52px] flex-row items-center justify-between gap-3 rounded-xl bg-champagne px-4 py-3 ${disabled ? 'opacity-75' : ''}`}>
            <IconSymbol name={detailActionCard.icon} size={20} color={noctalia.action.primaryText} />
            <Text key={`continue-${windowSize.fontScale}`} allowFontScaling={false} style={{ fontSize: 16 * compactTextScale, lineHeight: 24 * compactTextScale }} testID={TID.Text.DreamDetailActionTitle} className="flex-1 text-center font-sans-bold text-[16px] text-on-champagne">
              {detailActionCard.cta}
            </Text>
            <IconSymbol name="arrow.right" size={20} color={noctalia.action.primaryText} />
          </PressableScale>
          {renderQuotaHint()}
        </View>
      );
    }

    if (isSavedArrival && !isStalePrimaryAction) {
      // Act I ends on one clear next step: the story continues into the analysis when the
      // permission allows it, otherwise the journal is the way out and the offer stays secondary.
      const analysisFirst = visiblePrimaryAction === 'analyze' && !analysisAccessLabel
        && (savedAnalysisAction === 'analyze' || canResumeAnalysis);
      // One caption at most: the explanation of the offer, otherwise the allowance.
      const quotaCaption = guestNeedsAccount || arrivalMessage ? null : renderQuotaHint('center');
      const captions = arrivalMessage || quotaCaption ? (
        <View className="gap-1 px-2">
          {arrivalMessage ? (
            <Text testID={TID.Text.DreamDetailActionMessage}
              className="text-center font-sans text-[12px] leading-[17px] text-ivory-muted">
              {arrivalMessage}
            </Text>
          ) : null}
          {quotaCaption}
        </View>
      ) : null;
      const analysisButton = (
        <PressableScale
          testID={primaryButtonTestID}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityHint={quotaHintLabel ?? undefined}
          className={`flex-row items-center justify-center gap-2 px-4 ${
            analysisFirst ? 'min-h-[52px] rounded-md bg-champagne py-3' : 'min-h-[40px]'
          } ${disabled ? 'opacity-75' : ''}`}
        >
          <IconSymbol name={analysisIcon} size={18}
            color={analysisFirst ? noctalia.action.primaryText : noctalia.accent.text} />
          <Text testID={TID.Text.DreamDetailActionTitle}
            className={`shrink text-center ${analysisFirst ? 'font-sans-bold text-[16px] text-on-champagne' : 'font-sans-medium text-[15px] text-champagne-on'}`}>
            {analysisAccessLabel ?? detailActionCard.cta}
          </Text>
        </PressableScale>
      );
      const returnButton = renderReturnToJournal(analysisFirst);

      return (
        <View testID={TID.Component.DreamDetailActionCard} className={analysisFirst ? 'gap-2.5' : 'gap-1.5'}>
          {analysisFirst
            ? <>{analysisButton}{captions}{returnButton}</>
            : <>{returnButton}{analysisButton}{captions}</>}
        </View>
      );
    }

    return (
      <View
        testID={TID.Component.DreamDetailActionCard}
        className="gap-3"
      >
        <View className="flex-row items-start gap-3">
          <View className={`h-[34px] w-[34px] items-center justify-center rounded-full bg-ink-active`}>
            <IconSymbol name={detailActionCard.icon} size={18} color={noctalia.accent.text} />
          </View>
          <View className="flex-1 gap-1">
            <Text
              className={`font-sans-bold text-[11px] uppercase text-champagne-on`}
              testID={TID.Text.DreamDetailActionStep}
            >
              {detailActionCard.step}
            </Text>
            <Text
              key={`action-${windowSize.fontScale}`}
              allowFontScaling={false}
              style={{ fontSize: 17 * compactTextScale, lineHeight: 23 * compactTextScale }}
              className={`font-display-medium text-[17px] leading-[23px] text-ivory`}
              testID={TID.Text.DreamDetailActionTitle}
            >
              {guestNeedsAccount && savedAnalysisAction === 'signup' ? t('journal.detail.quota_limit.title_guest') : detailActionCard.title}
            </Text>
            {analysisAccessLabel ? null : (
              <Text
                className="font-sans text-[13px] leading-[18px] text-ivory-muted"
                testID={TID.Text.DreamDetailActionMessage}
              >
                {detailActionCard.message}
              </Text>
            )}
            {guestNeedsAccount ? null : renderQuotaHint()}
          </View>
        </View>
        <PressableScale
          testID={primaryButtonTestID}
          onPress={onPress}
          disabled={disabled}
          className={`flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-[13px] ${
            disabled ? 'opacity-75' : ''
          }`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityHint={quotaHintLabel ?? undefined}
        >
          {isPrimaryActionBusy ? (
            <ActivityIndicator size="small" color={noctalia.action.primaryText} />
          ) : (
            <IconSymbol name={analysisIcon} size={18} color={noctalia.action.primaryText} />
          )}
          <Text className="shrink text-center font-sans-bold text-[15px] text-on-champagne">
            {analysisAccessLabel ?? detailActionCard.cta}
          </Text>
        </PressableScale>
      </View>
    );
  };

  // After a guest's reading, as they read on: what a free account keeps safe and adds.
  const renderFirstValueBackupCard = () => {
    if (user || !analysisState.isAnalyzed || isEditing) {
      return null;
    }
    const benefits = [
      { icon: 'lock.shield' as const, text: t('journal.detail.account_invite.benefit.backup') },
      { icon: 'sparkles' as const, text: t('journal.detail.account_invite.benefit.analyses', { count: QUOTAS.free.analysis ?? 0 }) },
      { icon: 'book.fill' as const, text: t('journal.detail.account_invite.benefit.dreams') },
    ];

    return (
      <View testID={TID.Component.FirstValueBackupCard}
        className="mx-2 mb-7 gap-3 rounded-lg border border-line-strong bg-ink-soft p-5">
        <Text testID={TID.Text.FirstValueBackupTitle} accessibilityRole="header"
          className="font-display-semibold text-[20px] leading-[26px] text-ivory">
          {t('journal.detail.account_invite.title')}
        </Text>
        <Text className="font-sans text-[14px] leading-[20px] text-ivory-muted">
          {t('journal.detail.account_invite.message')}
        </Text>
        <View className="gap-2.5">
          {benefits.map((benefit) => (
            <View key={benefit.icon} className="flex-row items-start gap-2.5">
              <IconSymbol name={benefit.icon} size={16} color={noctalia.accent.text} style={{ marginTop: 2 }} />
              <Text className="flex-1 font-sans text-[14px] leading-[20px] text-ivory">{benefit.text}</Text>
            </View>
          ))}
        </View>
        <PressableScale
          testID={TID.Button.FirstValueBackupCta}
          onPress={handleFirstValueBackup}
          accessibilityRole="button"
          className="mt-1 min-h-[48px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3"
        >
          <Text className="font-sans-bold text-[15px] text-on-champagne">
            {t('journal.detail.account_invite.cta')}
          </Text>
          <IconSymbol name="arrow.right" size={18} color={noctalia.action.primaryText} />
        </PressableScale>
      </View>
    );
  };

  const renderStaleBanner = () => {
    if (!isAnalysisStale || isEditing || staleBannerDismissed) {
      return null;
    }

    return (
      <View
        testID={TID.Component.AnalysisStaleBanner}
        className="mb-[18px] gap-3 rounded-lg border border-warning-line bg-warning p-4"
      >
        <View className="flex-row items-start gap-3">
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color={noctalia.status.warning.icon} />
          <View className="flex-1 gap-1">
            <Text className="font-sans-bold text-[11px] uppercase text-warning-on">
              {t('journal.detail.stale.label')}
            </Text>
            <Text
              className="font-sans text-[13px] leading-[18px] text-warning-on"
              testID={TID.Text.AnalysisStaleBanner}
            >
              {t('journal.detail.stale.banner')}
            </Text>
          </View>
          <PressableScale
            testID={TID.Button.AnalysisStaleDismiss}
            onPress={dismissStaleBanner}
            accessibilityRole="button"
            accessibilityLabel={t('journal.detail.stale.dismiss')}
            className="-m-2.5 h-11 w-11 items-center justify-center"
          >
            <IconSymbol name="xmark" size={16} color={noctalia.status.warning.icon} />
          </PressableScale>
        </View>
      </View>
    );
  };

  const shouldShowIllustrationSection =
    Boolean(dream.imageUrl?.trim()) ||
    illustrationSidecar === 'pending' ||
    illustrationSidecar === 'failed' ||
    (analysisState.isAnalyzed && visibleIllustrationCta !== 'none');

  // The plate's picture: the illustration, drifting as the page scrolls, opens whole when pressed.
  const renderCoverPicture = () => (
    <PressableScale
      testID={TID.Button.JournalIllustrationExpand}
      onPress={() => setIsIllustrationFullscreen(true)}
      accessibilityRole="button"
      accessibilityLabel={t('journal.detail.image.expand_accessibility')}
      className="absolute inset-0"
    >
      <Animated.View ref={coverParallax.frame} onLayout={coverParallax.onLayout} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: -coverTravel, bottom: -coverTravel }, coverParallax.style]}>
      <Image
        key={displayImageUrl ?? dream.imageUrl}
        source={displayImageUrl ? { uri: displayImageUrl, cacheKey: imageCacheKey } : null}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        onError={() => setFailedCoverUri(displayImageUrl ?? null)}
        onLoad={() => markPerformance('image.native_loaded', { trace: performanceTraceId(imageTraceKey) })}
        onDisplay={() => { setCoverShown(true); markImageDisplayed(); }}
        transition={turnedTo || plateRevealed ? 0 : imageConfig.transition}
        cachePolicy={imageConfig.cachePolicy}
        priority={imageConfig.priority}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
      />
      </Animated.View>
      </Animated.View>
    </PressableScale>
  );

  const renderIllustrationSection = () => {
    if (shouldHideHeroMedia || !shouldShowIllustrationSection) {
      return null;
    }
    // The seal paints the illustration in its window, then lets it out to the plate.
    if (sealVisible && !coverImageFailed && (dream.imageUrl?.trim() || paintingRequested)) {
      return null;
    }

    return (
      <View testID={TID.Component.JournalIllustration} className="mb-5 overflow-hidden rounded-lg">
        {coverImageFailed ? (
          <View testID="journal.detail.image.unavailable" className="mx-2 mb-5 flex-row items-center gap-3 rounded-lg bg-ink-soft p-3">
            <IconSymbol name="photo" size={24} color={noctalia.text.secondary} />
            <Text className="flex-1 font-sans text-[13px] text-ivory-muted">{t('analysis.reading.image_unavailable')}</Text>
            <Pressable onPress={() => { setFailedCoverUri(null); media.retry(); }} accessibilityRole="button" className="min-h-11 justify-center">
              <Text className="font-sans-medium text-champagne-on">{t('journal.persistence.retry')}</Text>
            </Pressable>
          </View>
        ) : dream.imageUrl && !hasIllustratedCover ? (
          paintedArtwork ? (
            <DreamPaintedArtwork source={paintedArtwork} land={artworkLanding}
              onDisplay={markImageDisplayed}
              onOpen={() => setIsIllustrationFullscreen(true)}
              onError={() => setFailedCoverUri(displayImageUrl ?? null)} />
          ) : (
            <DreamPaintingWait queued={false} />
          )
        ) : dream.imageUrl ? null : paintingRequested ? (
          <DreamPaintingWait queued={dream.imageJobStatus === 'queued'} />
        ) : illustrationSidecar === 'failed' ? (
          visibleIllustrationCta === 'retry' || getImageJobFailure(dream.imageJobErrorCode) ? (
            <ImageRetry onRetry={onRetryImage} isRetrying={isRetryingImage}
              errorCode={dream.imageJobErrorCode}
              onManageSubscription={() => router.push('/settings?section=account')} />
          ) : (
            <View className="min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-ink-soft px-5 py-6">
              <IconSymbol name="photo" size={40} color={noctalia.text.secondary} />
              <Text className="text-center font-sans-bold text-[16px] text-ivory">
                {t('journal.detail.image.generation_failed')}
              </Text>
              <Text className="px-2 text-center font-sans text-[13px] leading-5 text-ivory-muted">
                {t('journal.detail.image.quota_exceeded_message')}
              </Text>
              {canOfferImageUpgrade ? (
                <PressableScale
                  onPress={handleImageUpgrade}
                  accessibilityRole="button"
                  testID={TID.Button.ImageUpgrade}
                  className="min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3"
                  style={shadows.md}
                >
                  <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                  <Text className="font-sans-bold text-[15px] text-on-champagne">
                    {t('journal.detail.image.upgrade_action')}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          )
        ) : sealIllustrates ? (
          // The seal offers the illustration; the page keeps only the dreamer's own picture.
          <PressableScale
            onPress={handlePickImage}
            disabled={isPickingImage || isAnalysisLocked}
            testID={TID.Button.JournalAddImageFromLibrary}
            accessibilityRole="button"
            accessibilityState={{ disabled: isPickingImage || isAnalysisLocked }}
            className={`min-h-[44px] flex-row items-center justify-center gap-2 self-center px-3 ${
              (isPickingImage || isAnalysisLocked) ? 'opacity-70' : ''
            }`}
          >
            {isPickingImage ? (
              <ActivityIndicator size="small" color={noctalia.text.secondary} />
            ) : (
              <IconSymbol name="photo" size={16} color={noctalia.text.secondary} />
            )}
            <Text className="font-sans-medium text-[14px] text-ivory-muted">
              {isPickingImage
                ? t('journal.detail.image.adding_from_library')
                : t('journal.detail.image.add_from_library')}
            </Text>
          </PressableScale>
        ) : (
          <View className="min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-ink-soft px-5 py-6">
            <IconSymbol name="photo" size={28} color={noctalia.text.secondary} />
            <Text className="text-center font-sans-bold text-[16px] text-ivory">
              {t('journal.detail.image.no_image_title')}
            </Text>
            <Text className="px-2 text-center font-sans text-[13px] leading-5 text-ivory-muted">
              {visibleIllustrationCta === 'quota'
                ? t('journal.detail.image.quota_exceeded_message')
                : t('journal.detail.image.no_image_subtitle')}
            </Text>
            {!isRetryingImage && !isImageJobPending && (
              <View className="w-full items-center gap-3">
                {visibleIllustrationCta === 'upgrade' && (
                  <PressableScale
                    onPress={handleImageUpgrade}
                    accessibilityRole="button"
                    testID={TID.Button.ImageUpgrade}
                    className="min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3"
                    style={shadows.md}
                  >
                    <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                    <Text className="font-sans-bold text-[15px] text-on-champagne">
                      {t('journal.detail.image.upgrade_action')}
                    </Text>
                  </PressableScale>
                )}
                {visibleIllustrationCta === 'illustrate' && (
                  <PressableScale
                    onPress={onRetryImage}
                    disabled={isRetryingImage || isImageJobPending}
                    testID={TID.Button.JournalIllustrate}
                    accessibilityRole="button"
                    className={`min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3 ${
                      isRetryingImage ? 'opacity-70' : ''
                    }`}
                    style={shadows.md}
                  >
                    <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                    <Text className="font-sans-bold text-[15px] text-on-champagne">
                      {t('journal.detail.image.generate_action')}
                    </Text>
                  </PressableScale>
                )}
                <PressableScale
                  onPress={handlePickImage}
                  disabled={isPickingImage || isAnalysisLocked}
                  className={`min-w-[150px] flex-row items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-3 ${
                    (isPickingImage || isAnalysisLocked) ? 'opacity-70' : ''
                  }`}
                >
                  {isPickingImage ? (
                    <ActivityIndicator color={noctalia.text.primary} />
                  ) : (
                    <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                  )}
                  <Text className="font-sans-bold text-[15px] text-ivory">
                    {isPickingImage
                      ? t('journal.detail.image.adding_from_library')
                      : t('journal.detail.image.add_from_library')}
                  </Text>
                </PressableScale>
              </View>
            )}
          </View>
        )}
        {isHdIllustrationsEnabled() && dream.imageJobErrorCode === 'HD_IMAGE_QUOTA_EXCEEDED' ? (
          <View className="gap-3 rounded-lg bg-ink-soft p-4">
            <Text accessibilityRole="alert" className="font-sans text-body-sm text-ivory">{t('settings.illustration.exhausted')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} className="min-h-[44px] justify-center">
              <Text className={`font-sans-medium text-champagne-on`}>{t('settings.illustration.preferences')}</Text>
            </Pressable>
          </View>
        ) : null}
        {isRetryingImage && dream.imageUrl ? (
          <View className="absolute inset-0 items-center justify-center rounded-lg bg-ink-overlay">
            <ActivityIndicator color={noctalia.text.primary} />
          </View>
        ) : null}
      </View>
    );
  };

  // Over a plate the head carries only the way back; on the paper it is printed with the journal's name.
  const runningHead = (
    <JournalRunningHead onBack={handleBackPress} testID="journal.detail.navigation" backTestID={TID.Button.NavigateJournal}
      label={hasIllustratedCover ? undefined : t('nav.sidebar_tagline')} />
  );
  const sealBlock = (
    <View ref={sealWindowRef} collapsable={false}>
      <SavedDreamMoment phase={savedMomentPhase} painting={paintingInProgress && !plateRevealed}
        handedOver={windowHandedOver} action={sealAction} sealing={sealShows}
        artwork={artworkAtArrival === false ? paintedArtwork : null} artworkAway={Boolean(coverFlight) || plateRevealed}
        landArtwork={artworkLanding} onOpenArtwork={() => setIsIllustrationFullscreen(true)}
        onArtworkDisplay={markImageDisplayed}
        onArtworkError={() => setFailedCoverUri(displayImageUrl ?? null)}
        date={formatDreamStamp(dream.id)} still={!opensOnSavedMoment && !readingInFlight}
        announce={opensOnSavedMoment} wordsLine={opensOnSavedMoment || readingInFlight} />
    </View>
  );
  const heading = (
    <View pointerEvents="box-none" className="w-full self-center" style={{ maxWidth: BOOK_MEASURE - 32 }}
      onLayout={({ nativeEvent: { layout } }) => {
        setCoverIntroHeight(previous => previous === layout.height ? previous : layout.height);
      }}>
      {/* After the seal, the name and date are already in place: they do not enter again. */}
      {!isEditing ? <ArrivalReveal play={opensOnSavedMoment && !windowHandedOver} index={0}>{renderMetadataCard()}</ArrivalReveal> : null}
    </View>
  );

  return (
    <View testID="screen.dreamDetail" className="relative flex-1 overflow-hidden bg-ink">
      <JournalPaper />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {/* Kept as real views: blocks come and go inside them while the page is read (the
            dock, the plate taking the running head's place), and the native mounting
            tracks those changes reliably only under parents that exist natively. */}
        <View className="flex-1" collapsable={false}>
        <ReadingScrollView
          ref={scrollViewRef}
          onContentSizeChange={revealRecallInput}
          className="flex-1"
          onLayout={({ nativeEvent: { layout } }) => {
            setCoverViewport(previous => previous?.width === layout.width && previous.height === layout.height
              ? previous : { width: layout.width, height: layout.height });
          }}

          contentContainerStyle={{
            paddingTop: hasIllustratedCover ? 0 : navigationHeight - RUNNING_HEAD_HEIGHT - RUNNING_HEAD_GAP,
            paddingBottom: ((isEditing) ? 220 : actionDockHeight + 32) + insets.bottom,
          }}
          scrollEventThrottle={16}
          onScroll={Platform.OS === 'web' ? (event) => {
            const { nativeEvent } = event;
            headerScrollY.set(nativeEvent.contentOffset.y);
            readingScrollOffset.set(nativeEvent.contentOffset.y);
            updateReadingChrome(nativeEvent.contentOffset.y);
            // The web has no end of drag or momentum: a pause in the scrolling stands for it.
            if (Platform.OS === 'web' && sealHoldsArtwork) {
              if (scrollRestRef.current) clearTimeout(scrollRestRef.current);
              scrollRestRef.current = setTimeout(releaseArtwork, SCROLL_REST_MS);
            }
          } : handleReadingScroll}
          // Scrolled back to a seal still holding its illustration, the reader sees it leave.
          onScrollEndDrag={sealHoldsArtwork ? releaseArtwork : undefined}
          onMomentumScrollEnd={sealHoldsArtwork ? releaseArtwork : undefined}
          // While the illustration leaves for the plate, the reading holds still on the screen
          // as the plate comes in above it. The reading is the third block under the running
          // head and the name, the second under the plate: the index must name it, or the
          // native side keeps an anchor it can no longer find and drifts on every update.
          maintainVisibleContentPosition={holdsReading
            ? { minIndexForVisible: hasIllustratedCover ? 1 : 2 } : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {hasIllustratedCover ? (
            <JournalCoverPlate testID={TID.Component.JournalIllustration} height={coverHeight} titleHeight={coverIntroHeight}
              picture={renderCoverPicture()} head={runningHead}>
              {heading}
            </JournalCoverPlate>
          ) : (
            <View style={{ marginBottom: RUNNING_HEAD_GAP }} collapsable={false}>{runningHead}</View>
          )}
          {/* The name, then the reading, which starts with the name's seal. */}
          {hasIllustratedCover ? null : <View className="px-4" collapsable={false}>{heading}</View>}
          <View ref={readingContentRef} collapsable={false} className="w-full self-center px-4 pb-6" style={{ maxWidth: BOOK_MEASURE }}
            onLayout={({ nativeEvent: { layout } }) => {
              setReadingContentTop((previous) => (previous === layout.y ? previous : layout.y));
            }}>
            {sealVisible ? (
              <OpenUp appear={!opensOnSavedMoment && readingInFlight}>{sealBlock}</OpenUp>
            ) : null}
            {sealVisible && showCompletedReading && !readingInFlight && !isEditing ? (
              <JournalSealShare onShare={onShare} disabled={isSharing || isAnalysisLocked || shareMediaPending}
                busy={isSharing || shareMediaPending} />
            ) : null}
            {/* The reading, under its seal and before the story it reads. */}
            <View>{renderStaleBanner()}</View>
            {readingBegun ? (
              <OpenUp appear={readingInFlight}
                onLayout={({ nativeEvent }) => { readingZoneTopRef.current = nativeEvent.layout.y; }}>
                <DreamAnalysisContent dream={dream}
                  pending={isAnalysisPending || readingAwaited}
                  onInterpretationLayout={({ nativeEvent: { layout } }) => setInterpretationLayout((current) =>
                    current?.key === readingLayoutKey && current.top === layout.y
                      ? current : { key: readingLayoutKey, top: layout.y })}
                  reveal={readingStory === 'revealed'} />
              </OpenUp>
            ) : null}
            {showCompletedReading && !readingInFlight && lastFreeAnalysesNudge ? (
              <FreeAnalysesNudge nudge={lastFreeAnalysesNudge} className="mx-2 mb-6" />
            ) : null}
            {!isEditing && dreamMemoryItems.length > 0 && (
              <View className="mx-2 mb-8 gap-3">
                <BookSectionMark label={t('journal.detail.zone.memory')} scale={compactTextScale} className="mb-1" />
                {dreamMemoryItems.map((item) => (
                  <View key={item.key} className="gap-0.5">
                    <Text className="font-serif-italic text-[13px] leading-[18px] text-ivory-muted">
                      {item.label}
                    </Text>
                    <Text className="font-serif text-[16px] leading-6 text-ivory">
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Native navigation supplies the transition; frequent detail visits show sections immediately. */}
            {recallRequested ? (
              <DreamRecallAssistantCard
                dreamId={getDreamRecallStorageId(dream, user?.id ?? null)}
                originalTranscript={dream.transcript}
                originalPersistedSegmentId={dream.clientRequestId ?? (dream.remoteId != null ? getDreamIdentityKey(dream) : String(dream.id))}
                onAnswerFocus={handleRecallFocus}
                onAnswerLayout={handleRecallLayout}
                offerEligible
                startRequested
              />
            ) : null}
            <View>{renderSyncStatusCard()}</View>

            {!isEditing && (
              <ArrivalReveal play={opensOnSavedMoment && !windowHandedOver} index={1} className="mt-2 mb-5">
                <View>
                  <View className="px-2 pb-4">
                    {renderTranscriptBody()}
                  </View>
                </View>
              </ArrivalReveal>
            )}
            {opensOnSavedMoment && !isEditing && !detailsOnSeal ? (
              <ArrivalLater play={!windowHandedOver} ready={!namingOn}>
                <View className="mx-2 mb-7">{renderMetadataChips()}</View>
              </ArrivalLater>
            ) : null}

            {/* A guest reads on into what an account keeps and adds. */}
            {showCompletedReading && !readingInFlight ? renderFirstValueBackupCard() : null}
            {!hasIllustratedCover ? renderIllustrationSection() : null}
            {!recallRequested ? (
              <ArrivalReveal play={opensOnSavedMoment && !windowHandedOver} index={2}>
                <DreamRecallAssistantCard dreamId={getDreamRecallStorageId(dream, user?.id ?? null)}
                  originalTranscript={dream.transcript}
                  originalPersistedSegmentId={dream.clientRequestId ?? (dream.remoteId != null ? getDreamIdentityKey(dream) : String(dream.id))}
                  onAnswerFocus={handleRecallFocus}
                onAnswerLayout={handleRecallLayout}
                  offerEligible={recallOffer.offerEligible} />
              </ArrivalReveal>
            ) : null}


            <View>
              {/* The page ends as a book's last page does: an ornament, then what can be done with it. */}
              <BookOrnament className="mt-3 mb-4" />
              <View accessibilityRole="toolbar" accessibilityLabel={t('journal.detail.zone.actions')}
                className="mb-1 flex-row flex-wrap items-center justify-center">
                <PressableScale
                  onPress={handleToggleFavorite}
                  disabled={isAnalysisLocked}
                  testID={TID.Button.DreamFavorite}
                  accessibilityRole="button"
                  accessibilityLabel={t('journalDetail.a11y.toggleFavorite')}
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                  className={`min-h-[44px] flex-row items-center justify-center gap-2 px-4 ${
                    isAnalysisLocked ? 'opacity-60' : ''
                  }`}
                >
                  <IconSymbol
                    name={dream.isFavorite ? 'heart.fill' : 'heart'}
                    size={18}
                    color={noctalia.accent.text}
                  />
                  <Text className="font-serif-italic text-[16px] text-ivory">
                    {dream.isFavorite
                      ? t('journal.detail.favorite.on')
                      : t('journal.detail.favorite.off')}
                  </Text>
                </PressableScale>
                <View accessible={false} className="h-5 w-px bg-line" />
                <PressableScale
                  onPress={onShare}
                  disabled={isSharing || isAnalysisLocked || shareMediaPending}
                  testID={TID.Button.DreamShare}
                  accessibilityRole="button"
                  accessibilityLabel={t('journalDetail.a11y.shareDream')}
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                  className={`min-h-[44px] flex-row items-center justify-center gap-2 px-4 ${
                    isSharing || isAnalysisLocked || shareMediaPending ? 'opacity-70' : ''
                  }`}
                >
                  {isSharing || shareMediaPending ? (
                    <ActivityIndicator size="small" color={noctalia.accent.text} />
                  ) : (
                    <IconSymbol name="square.and.arrow.up" size={18} color={noctalia.accent.text} />
                  )}
                  <Text className="font-serif-italic text-[16px] text-ivory">
                    {isSharing || shareMediaPending
                      ? t('journal.detail.share.button_loading')
                      : t('journal.detail.share.button_default')}
                  </Text>
                </PressableScale>
              </View>

              <View className="flex-row items-center justify-center self-center">
              {isEditing ? null : (
                <>
                  <JournalEditLink onEdit={startEditing} disabled={isAnalysisLocked} />
                  <View accessible={false} className="h-5 w-px bg-line" />
                </>
              )}
              <PressableScale
                onPress={onDelete}
                disabled={isAnalysisLocked}
                accessibilityState={{ disabled: isAnalysisLocked }}
                className={`min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 px-3 ${isAnalysisLocked ? 'opacity-70' : ''}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                testID={TID.Button.DreamDelete}
                accessibilityLabel={t('journalDetail.a11y.deleteDream')}
              >
                <IconSymbol name="trash" size={16} color={noctalia.status.danger.icon} />
                <Text className={`font-serif-italic text-[15px] text-danger-on`}>
                  {t('journal.menu.delete')}
                </Text>
              </PressableScale>
              </View>
              {hasGeneratedContent ? (
                <PressableScale
                  onPress={onReportGeneratedContent}
                  className="mt-2 min-h-[44px] flex-row items-center justify-center gap-1.5 self-center px-3"
                  hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                  accessibilityRole="link"
                  testID={TID.Button.DreamReport}
                >
                  <IconSymbol name="flag" size={15} color={noctalia.text.tertiary} />
                  <Text className="font-sans text-[13px] text-ivory-muted">
                    {t('journal.detail.report.button')}
                  </Text>
                </PressableScale>
              ) : null}
              <JournalFolio folio={folio} className="mt-8" turns="dream" />
            </View>
            </View>
        </ReadingScrollView>

        <JournalReturnTab top={insets.top + 6} onPress={handleBackPress} />
        {coverFlight && paintedArtwork ? (
          <CoverFlight source={paintedArtwork} from={coverFlight.from} to={coverFlight.to} height={coverHeight} travel={coverTravel}
            landed={coverFlight.landed} onArrived={coverFlightArrived} onGone={coverFlightGone} />
        ) : null}
        {!isEditing && !isKeyboardVisible && (!hasIllustratedCover || readingActionVisible) && !(sealShowsReading && !isSavedArrival) ? (
          <View testID="component.dreamDetail.actionDock"
            className={`absolute bottom-0 left-0 right-0 bg-ink px-6 pt-3 ${isSavedArrival ? '' : 'border-t border-line'}`}
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            onLayout={({ nativeEvent }) => setActionDockHeight(nativeEvent.layout.height)}>
            <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
              <View style={{ position: 'absolute', left: 0, right: 0, top: actionDockHeight - windowSize.height, height: windowSize.height }}>
                <JournalPaper />
              </View>
            </View>
            {isSavedArrival ? (
              <LinearGradient pointerEvents="none"
                colors={[`${noctalia.screen.background}00`, noctalia.screen.background]}
                style={{ position: 'absolute', left: 0, right: 0, top: -32, height: 32 }} />
            ) : null}
            <View className="w-full self-center" style={{ maxWidth: BOOK_MEASURE - 32 }}>
              <ArrivalLater play={opensOnSavedMoment && !windowHandedOver} ready={!namingOn}>{renderDetailActionCard()}</ArrivalLater>
            </View>
          </View>
        ) : null}

        {isEditing && (
          <View pointerEvents="auto" testID={TID.Component.DreamEditor} className="absolute inset-0 bg-ink-overlay"
            style={{ paddingTop: insets.top }}>
            {Platform.OS === 'ios' && isKeyboardVisible ? (
              <Pressable
                onPress={Keyboard.dismiss}
                testID="btn.journal.dismissKeyboard"
                accessibilityRole="button"
                accessibilityLabel={t('common.done')}
                className="min-h-11 items-end justify-center self-end px-7"
              >
                <Text className="font-sans-medium text-[15px] text-champagne-on">{t('common.done')}</Text>
              </Pressable>
            ) : null}
            <ScrollView ref={editorScrollRef} className="flex-1" keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: floatingTranscriptBottom }}
              onLayout={() => {
                // The keyboard shrinks the sheet: keep the story being written in view.
                if (editingStoryRef.current) editorScrollRef.current?.scrollToEnd({ animated: true });
              }}>
              {dream.imageUrl ? (
                <View className="mb-3 w-full items-center border-transparent bg-transparent">
                  {dream.imageSource !== 'ai' ? (
                    <PressableScale
                      onPress={handlePickImage}
                      disabled={isPickingImage || isAnalysisLocked}
                      className={`flex-row items-center gap-2 rounded-[10px] border border-line bg-ink-raised px-3.5 py-2.5 ${
                        (isPickingImage || isAnalysisLocked) ? 'opacity-70' : ''
                      }`}
                    >
                      {isPickingImage ? (
                        <ActivityIndicator color={noctalia.text.primary} />
                      ) : (
                        <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                      )}
                      <Text className="font-sans-bold text-[14px] text-ivory">
                        {isPickingImage
                          ? t('journal.detail.image.adding_from_library')
                          : t('journal.detail.image.replace_user_button')}
                      </Text>
                    </PressableScale>
                  ) : (
                    <Text className="rounded-[10px] bg-ink-raised px-3.5 py-2.5 text-center font-sans-medium text-[13px] leading-[18px] text-ivory-muted">
                      {t('journal.detail.image.ai_locked_note')}
                    </Text>
                  )}
                </View>
              ) : null}
              {renderMetadataCard('floating')}
              <View className="rounded-lg border border-line bg-ink-raised px-4 pt-5 pb-3" style={shadows.xl}>
                {renderTranscriptBody()}
                <View className="mt-3 flex-row flex-wrap justify-end gap-3">
                  <Pressable onPress={cancelEditing} testID={TID.Button.CancelDreamEdit} accessibilityRole="button"
                    className="min-h-[44px] justify-center px-3">
                    <Text className="font-sans-medium text-ivory">{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={handleSave} testID={TID.Button.SaveDreamEdit} accessibilityRole="button"
                    disabled={isAnalysisLocked} className="min-h-[44px] justify-center rounded-md bg-champagne px-4">
                    <Text className="font-sans-bold text-on-champagne">{t('journal.detail.save_edit')}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
        <AnalysisNoticeSheet
          visible={Boolean(analysisNotice)}
          onClose={handleDismissAnalysisNotice}
          notice={displayedAnalysisNotice}
        />
        <ReplaceImageSheet
          visible={showReplaceImageSheet}
          onClose={handleDismissReplaceSheet}
          onReplace={handleReplaceImage}
          onKeep={handleKeepImage}
          isLocked={isAnalysisLocked}
        />
        <ReanalyzeSheet
          visible={showReanalyzeSheet}
          onClose={handleDismissReanalyzeSheet}
          onConfirm={handleConfirmReanalyze}
          isLocked={isAnalysisLocked}
          imagePolicy={reanalyzeImagePolicy}
          onImagePolicyChange={handleReanalyzeImagePolicyChange}
        />
        <Modal
          visible={isIllustrationFullscreen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsIllustrationFullscreen(false)}
        >
          <View
            testID={TID.Modal.JournalIllustrationFullscreen}
            className="flex-1 bg-ink"
          >
            <Pressable
              className="absolute inset-0"
              onPress={() => setIsIllustrationFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('journal.detail.image.close_fullscreen')}
            />
            <View className="flex-1 items-center justify-center px-4">
              {dream.imageUrl ? (
                <Image
                  source={displayImageUrl ? { uri: displayImageUrl, cacheKey: imageCacheKey } : null}
                  style={{ width: '100%', height: '80%' }}
                  contentFit="contain"
                />
              ) : null}
            </View>
            <PressableScale
              onPress={() => setIsIllustrationFullscreen(false)}
              testID={TID.Button.JournalIllustrationClose}
              accessibilityRole="button"
              accessibilityLabel={t('journal.detail.image.close_fullscreen')}
              className="absolute right-5 items-center justify-center rounded-full border border-line bg-ink-raised"
              style={{ top: insets.top + 12, height: 44, width: 44 }}
            >
              <IconSymbol name="xmark" size={18} color={noctalia.text.primary} />
            </PressableScale>
          </View>
        </Modal>
        <DeleteConfirmSheet
          visible={showDeleteSheet}
          onClose={handleCloseDeleteSheet}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
        <QuotaLimitSheet
          visible={showQuotaLimitSheet}
          onClose={handleQuotaLimitDismiss}
          onPrimary={handleQuotaLimitPrimary}
          onSecondary={handleQuotaLimitSecondary}
          tier={tier}
          mode={quotaSheetMode}
          usageLimit={usage?.analysis.limit}
        />
        <ImageErrorSheet
          visible={Boolean(imageErrorMessage)}
          onClose={handleDismissImageError}
          onRetry={handleRetryImageError}
          isRetrying={isRetryingImage}
          message={imageErrorMessage}
          canRetry={imageErrorCanRetry}
          onManageSubscription={imageErrorNeedsSubscription ? () => {
            setImageErrorMessage(null);
            router.push('/settings?section=account');
          } : undefined}
        />
        <Modal
          visible={isShareModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeShareModal}
        >
          <View className="flex-1 items-center justify-center bg-ink-overlay p-6">
            <Pressable className="absolute inset-0" onPress={closeShareModal} />
            <View className="w-full max-w-[420px] gap-4 rounded-[20px] bg-ink-raised p-6"
            >
              <Text className="font-serif-bold text-[20px] text-ivory">
                {t('journal.detail.share_modal.title')}
              </Text>
              <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted"
              >
                {clipboardSupported
                  ? t('journal.detail.share_modal.description.clipboard')
                  : t('journal.detail.share_modal.description.manual')}
              </Text>
              <View className="rounded-[14px] border border-line bg-ink-soft p-4">
                <Text selectable className="font-serif text-body text-ivory"
                >
                  {shareMessage || t('journal.detail.share_modal.empty')}
                </Text>
              </View>
              {clipboardSupported && (
                <PressableScale
                  className="flex-row items-center justify-center gap-2 rounded-full bg-champagne py-3"
                  onPress={handleCopyShareText}
                  testID={TID.Button.ShareCopy}
                  accessibilityLabel={t('journalDetail.a11y.copyShareText')}
                >
                  <IconSymbol
                    name={shareCopyStatus === 'success' ? 'checkmark' : 'doc.on.doc'}
                    size={18}
                    color={noctalia.action.primaryText}
                  />
                  <Text className="font-sans-bold text-[15px] text-on-champagne"
                  >
                    {shareCopyStatus === 'success'
                      ? t('journal.detail.share_modal.copied')
                      : t('journal.detail.share_modal.copy')}
                  </Text>
                </PressableScale>
              )}
              {shareCopyStatus === 'error' && (
                <Text className="text-center font-sans-medium text-[13px] text-danger-on"
                >
                  {t('journal.detail.share_modal.copy_failed')}
                </Text>
              )}
              <PressableScale
                className="items-center rounded-full border border-line py-3"
                onPress={closeShareModal}
                testID={TID.Button.ShareClose}
                accessibilityLabel={t('journalDetail.a11y.closeShareModal')}
              >
                <Text className="font-sans-medium text-[14px] text-ivory-muted"
                >
                  {t('journal.detail.share_modal.close')}
                </Text>
              </PressableScale>
            </View>
          </View>
        </Modal>

        {savedConfirmationVisible && !opensOnSavedMoment ? (
          <Toast
            message={t('recording.save.confirmation')}
            mode="success"
            onHide={() => setSavedConfirmationVisible(false)}
            testID={TID.Text.RecordingSaveConfirmation}
          />
        ) : null}

        {favoriteError ? (
          <Toast
            message={favoriteError}
            mode="error"
            onHide={() => setFavoriteError(null)}
          />
        ) : null}

        {/* Mount the share composite only for an active native share request. */}
        {shareRequest && (
          <View className="absolute top-0 left-[-10000px] h-[1350px] w-[1080px]">
            <DreamShareImage
              key={shareRequest.id}
              ref={shareImageRef}
              dream={shareRequest.dream}
              t={t}
              resolvedMedia={{ imageUrl: shareRequest.source }}
              onMediaReady={shareRequest.onMediaReady}
            />
          </View>
        )}
        {/* The journal page's own edges, over everything that rests on it. */}
        {!isEditing ? <JournalPageEdges /> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

// The dream's page draws its own bar over the status bar.
export default withHeaderScroll(JournalDetailScreen, { veil: false });
