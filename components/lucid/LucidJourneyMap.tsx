import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASING, PressableScale } from '@/components/motion';
import {
  getLucidPalette,
  LucidIcon,
  LucidPress,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import type { LucidProgramSession } from '@/lib/lucid/content/types';

const JOURNEY_BACKGROUND = require('@/assets/images/lucid/mild-journey-path.png');
const CURRENT_SESSION_ART = require('@/assets/images/lucid/mild-session-portal.png');
const JOURNEY_ASPECT_RATIO = 915 / 1719;
const IMMERSIVE_CARD_GAP = LucidSpace.xl * 7;
const IMMERSIVE_SPLIT_CLEARANCE = LucidSpace.xl + LucidSpace.md;
const REFLOW_FONT_SCALE = 1.3;
const REFLOW_MIN_WIDTH = 380;

export type LucidJourneyStatus = 'completed' | 'current' | 'available' | 'upcoming';

export type LucidJourneyDay = Readonly<{
  session: LucidProgramSession;
  status: LucidJourneyStatus;
  dateLabel?: string;
}>;

export type LucidJourneyLabels = Readonly<{
  progress: string;
  session: string;
  completed: string;
  current: string;
  available: string;
  upcoming: string;
  duration: string;
  safetyTitle: string;
  safetyBody: string;
  unlockHint: string;
}>;

export function canOpenLucidJourneySession(
  day: LucidJourneyDay,
  startedOrProgress: boolean | number,
  sessionsEnabled?: boolean
) {
  const started =
    typeof startedOrProgress === 'boolean' ? startedOrProgress : startedOrProgress > 0;
  const enabled = sessionsEnabled ?? started;

  if (day.status === 'completed') return true;
  if (day.status === 'upcoming') return false;
  return started && enabled;
}

export function shouldUseLucidJourneyReflow(width: number, fontScale: number) {
  return width < REFLOW_MIN_WIDTH || fontScale >= REFLOW_FONT_SCALE;
}

/**
 * Derive the visible journey from persisted progress only. A newly discovered
 * program starts at session 1, but no session is marked complete until its real
 * exercise id exists in storage.
 */
export function buildLucidJourneyDays({
  sessions,
  completedExerciseIds,
  currentDay,
  started,
}: {
  sessions: readonly LucidProgramSession[];
  completedExerciseIds: readonly string[];
  currentDay: number;
  started: boolean;
}): LucidJourneyDay[] {
  const completedIds = new Set(completedExerciseIds);
  const boundedCurrentDay = Math.max(1, Math.min(currentDay, sessions.length));

  return sessions.map((session) => {
    if (completedIds.has(session.id)) return { session, status: 'completed' };
    if (session.session === boundedCurrentDay) return { session, status: 'current' };
    if (started && session.session < boundedCurrentDay) return { session, status: 'available' };
    return { session, status: 'upcoming' };
  });
}

export function LucidJourneyMap({
  programLabel,
  progressValue,
  started = progressValue > 0,
  sessionsEnabled = started,
  days,
  currentSession,
  labels,
  primaryActionLabel,
  primaryActionLoading = false,
  reduceMotion = false,
  immersive = false,
  immersiveTopInset = 0,
  trailing,
  onPrimaryAction,
  onSessionPress,
}: {
  programLabel: string;
  progressValue: number;
  /** Distinguishes an unstarted 0/7 program from a started program with 0 completed sessions. */
  started?: boolean;
  /** Paused programs keep completed sessions readable without opening active sessions. */
  sessionsEnabled?: boolean;
  days: readonly LucidJourneyDay[];
  currentSession: LucidProgramSession;
  labels: LucidJourneyLabels;
  primaryActionLabel: string;
  primaryActionLoading?: boolean;
  reduceMotion?: boolean;
  /** Renders progress and the active-session CTA directly over the journey artwork. */
  immersive?: boolean;
  /** Keeps the immersive progress overlay below device chrome. */
  immersiveTopInset?: number;
  trailing?: ReactNode;
  onPrimaryAction: () => void;
  onSessionPress: (session: LucidProgramSession) => void;
}) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  // The journey is deliberately a night scene in both app themes. Its text
  // therefore reads from the audited dark palette instead of changing colour
  // over a fixed dark raster when the rest of the app switches to light mode.
  const palette = getLucidPalette(colors, 'dark');
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion || systemReducedMotion;
  const chronologicalDays = [...days].sort(
    (left, right) => left.session.session - right.session.session
  );
  const visualJourneyDays = [...chronologicalDays].reverse();
  const reflow = shouldUseLucidJourneyReflow(width, fontScale);
  const [sceneWidth, setSceneWidth] = useState(width);
  const naturalSceneHeight = sceneWidth / JOURNEY_ASPECT_RATIO;
  const currentAnchor = journeyAnchorForSession(currentSession.session);
  const insertionY = Math.min(
    naturalSceneHeight,
    naturalSceneHeight * currentAnchor.top + IMMERSIVE_SPLIT_CLEARANCE
  );
  const immersiveSceneHeight = naturalSceneHeight + IMMERSIVE_CARD_GAP;

  const progressHeader = (
    <View
      style={[
        styles.header,
        immersive && (reflow ? styles.headerImmersiveReflow : styles.headerImmersive),
        immersive && !reflow && { top: immersiveTopInset + LucidSpace.sm },
        {
          backgroundColor: immersive ? 'transparent' : palette.overlay,
          borderColor: immersive ? 'transparent' : palette.border,
        },
      ]}
      testID="lucid-journey-progress-header"
    >
      <View style={[styles.headerTopRow, immersive && styles.headerTopRowImmersive]}>
        <Text style={[styles.overline, { color: palette.textSecondary }]}>{programLabel}</Text>
        {trailing}
      </View>
      <View style={[styles.progressRow, immersive && styles.progressRowImmersive]}>
        <Text
          accessibilityRole="header"
          style={[
            styles.progress,
            immersive && styles.progressImmersive,
            { color: palette.text },
          ]}
        >
          <Text style={{ color: palette.accent }}>{progressValue}</Text>
          <Text style={{ color: palette.textSecondary }}> / {days.length}</Text>
        </Text>
        <View
          accessible
          accessibilityLabel={`${labels.progress} ${progressValue} / ${days.length}`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: days.length, now: progressValue }}
          style={[styles.progressMeter, immersive && styles.progressMeterImmersive]}
        >
          {!immersive ? (
            <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
              {labels.progress}
            </Text>
          ) : null}
          <View pointerEvents="none" style={styles.progressSegments}>
            {chronologicalDays.map((day) => {
              const completed = day.status === 'completed';
              return (
                <View
                  key={day.session.id}
                  testID={`lucid-journey-progress-${day.session.session}`}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: completed
                        ? palette.success
                        : palette.borderInteractive,
                      opacity: completed ? 1 : 0.48,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  const currentCard = (
    <CurrentSessionCard
      actionLabel={primaryActionLabel}
      compact={immersive && !reflow}
      labels={labels}
      loading={primaryActionLoading}
      objectiveNumberOfLines={immersive && reflow ? undefined : 2}
      reduceMotion={motionReduced}
      session={currentSession}
      onPress={onPrimaryAction}
    />
  );

  const safety = (
    <View
      accessible
      accessibilityLabel={`${labels.safetyTitle}. ${labels.safetyBody}`}
      style={[styles.safety, { backgroundColor: palette.overlay, borderColor: palette.border }]}
      testID="lucid-journey-safety"
    >
      <Ionicons name="shield-checkmark-outline" size={LucidIcon.lg} color={palette.amber} />
      <View style={styles.safetyCopy}>
        <Text style={[styles.safetyTitle, { color: palette.amber }]}>
          {labels.safetyTitle}
        </Text>
        <Text style={[styles.safetyBody, { color: palette.textSecondary }]}>
          {labels.safetyBody}
        </Text>
      </View>
    </View>
  );

  const journeyScene = (
    <View
      onLayout={
        immersive && !reflow
          ? ({ nativeEvent }) => {
              const nextWidth = nativeEvent.layout.width;
              if (Math.abs(nextWidth - sceneWidth) > 0.5) setSceneWidth(nextWidth);
            }
          : undefined
      }
      style={[
        styles.scene,
        reflow
          ? styles.sceneReflow
          : immersive
            ? { height: immersiveSceneHeight }
            : styles.sceneMap,
        immersive && styles.sceneImmersive,
        immersive && { backgroundColor: palette.backgroundDeep },
      ]}
      testID="lucid-journey-scene"
    >
      {immersive && !reflow ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.sceneImageClip, { top: 0, height: insertionY }]}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey="lucid-journey-path-v3-upper"
              source={JOURNEY_BACKGROUND}
              style={[
                styles.segmentedImage,
                { top: 0, width: sceneWidth, height: naturalSceneHeight },
              ]}
              testID="lucid-journey-background"
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.sceneImageClip,
              {
                top: insertionY + IMMERSIVE_CARD_GAP,
                height: naturalSceneHeight - insertionY,
              },
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey="lucid-journey-path-v3-lower"
              source={JOURNEY_BACKGROUND}
              style={[
                styles.segmentedImage,
                {
                  top: -insertionY,
                  width: sceneWidth,
                  height: naturalSceneHeight,
                },
              ]}
            />
          </View>
        </>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey="lucid-journey-path-v2"
          source={JOURNEY_BACKGROUND}
          style={StyleSheet.absoluteFill}
          testID="lucid-journey-background"
        />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      {immersive ? progressHeader : null}

      <View
        accessibilityRole="list"
        style={[styles.path, reflow ? styles.pathReflow : styles.pathMap]}
        testID="lucid-journey-path"
      >
        {visualJourneyDays.map((day) => {
          const canOpen = canOpenLucidJourneySession(day, started, sessionsEnabled);
          const isCurrentSession = day.session.session === currentSession.session;
          return (
            <Fragment key={day.session.id}>
              <JourneyNode
                day={day}
                labels={labels}
                lockedHint={
                  day.status === 'upcoming' ? labels.unlockHint : primaryActionLabel
                }
                compact={immersive && !reflow}
                mapStyle={
                  !reflow
                    ? immersive
                      ? immersiveAnchorForSession(
                          day.session.session,
                          currentSession.session,
                          naturalSceneHeight
                        )
                      : anchorForSession(day.session.session)
                    : undefined
                }
                reduceMotion={motionReduced}
                reflow={reflow}
                onPress={canOpen ? () => onSessionPress(day.session) : undefined}
              />
              {immersive && isCurrentSession ? (
                <View
                  style={[
                    reflow ? styles.currentCardReflow : styles.currentCardMap,
                    !reflow && { top: insertionY + LucidSpace.sm },
                  ]}
                  testID="lucid-journey-current-dock"
                >
                  {currentCard}
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </View>
    </View>
  );

  return (
    <View
      accessibilityLabel={`${programLabel}, ${labels.progress} ${progressValue} / ${days.length}`}
      style={[
        styles.root,
        immersive ? styles.rootImmersive : styles.rootContained,
        {
          backgroundColor: immersive ? 'transparent' : palette.backgroundDeep,
          borderColor: immersive ? 'transparent' : palette.border,
        },
      ]}
      testID="lucid-journey-map"
    >
      {immersive ? (
        <>
          {journeyScene}
          <View style={styles.safetyImmersive}>{safety}</View>
        </>
      ) : (
        <>
          {progressHeader}
          <View style={styles.dock}>
            {currentCard}
            {safety}
          </View>
          {journeyScene}
        </>
      )}
    </View>
  );
}

function JourneyNode({
  day,
  labels,
  lockedHint,
  compact,
  mapStyle,
  reduceMotion,
  reflow,
  onPress,
}: {
  day: LucidJourneyDay;
  labels: LucidJourneyLabels;
  lockedHint: string;
  compact: boolean;
  mapStyle?: ViewStyle;
  reduceMotion: boolean;
  reflow: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const palette = getLucidPalette(colors, 'dark');
  const entrance = useSharedValue(day.status === 'current' && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (day.status !== 'current' || reduceMotion) {
      entrance.set(1);
      return;
    }
    entrance.set(withTiming(1, { duration: DURATION.fast, easing: EASING.out }));
  }, [day.status, entrance, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = entrance.get();
    return {
      opacity: value,
      transform: [{ scale: reduceMotion ? 1 : 0.96 + 0.04 * value }],
    };
  });

  const stateLabel =
    day.status === 'completed'
      ? labels.completed
      : day.status === 'current'
        ? labels.current
        : day.status === 'available'
          ? labels.available
          : labels.upcoming;
  const label = `${labels.session} ${day.session.session}, ${day.session.title}, ${stateLabel}${day.dateLabel ? `, ${day.dateLabel}` : ''}`;
  const active = day.status === 'current';
  const completed = day.status === 'completed';
  const available = day.status === 'available';
  const nodeColor = active
    ? palette.accent
    : completed
      ? palette.success
      : available
        ? palette.text
        : palette.textMuted;
  const nodeBackground = active
    ? palette.accentSoft
    : completed
      ? palette.successSoft
      : palette.surfaceMuted;
  const markerBackground = active && !compact
    ? palette.overlay
    : 'transparent';
  const markerBorder = active && !compact
    ? palette.accent
    : 'transparent';

  return (
    <Animated.View
      style={[
        styles.nodeRow,
        reflow ? styles.nodeRowReflow : styles.nodeRowMap,
        mapStyle,
        animatedStyle,
      ]}
    >
      <PressableScale
        accessibilityLabel={label}
        accessibilityHint={onPress ? undefined : lockedHint}
        accessibilityRole="button"
        accessibilityState={{ disabled: !onPress, selected: active }}
        disabled={!onPress}
        onPress={onPress}
        scale={reduceMotion ? 1 : LucidPress.scale}
        testID={`lucid-journey-session-${day.session.session}`}
        transitionProperties={['backgroundColor', 'borderColor']}
        style={[
          styles.nodePressable,
          active && styles.nodePressableCurrent,
          {
            backgroundColor: markerBackground,
            borderColor: markerBorder,
            opacity: day.status === 'upcoming' ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.nodeOrbFrame}>
          {active ? (
            <View
              pointerEvents="none"
              style={[styles.nodeHalo, { borderColor: palette.accent }]}
            />
          ) : null}
          <View
            style={[
              styles.nodeOrb,
              active && styles.nodeOrbCurrent,
              {
                backgroundColor: nodeBackground,
                borderColor: nodeColor,
              },
            ]}
          >
            {completed ? (
              <Ionicons name="checkmark" size={LucidIcon.md} color={nodeColor} />
            ) : active ? (
              <Ionicons name="eye" size={LucidIcon.lg} color={nodeColor} />
            ) : available ? (
              <Ionicons name="ellipse-outline" size={LucidIcon.md} color={nodeColor} />
            ) : (
              <Ionicons name="moon-outline" size={LucidIcon.md} color={nodeColor} />
            )}
          </View>
        </View>
        <View
          style={[
            styles.nodeCopy,
            compact && styles.nodeCopyCompact,
            { backgroundColor: compact ? 'transparent' : palette.overlay },
          ]}
        >
          {compact ? (
            <Text
              numberOfLines={2}
              style={[
                styles.nodeCompactLabel,
                {
                  color: active
                    ? palette.accent
                    : day.status === 'upcoming'
                      ? palette.textSecondary
                      : palette.text,
                },
              ]}
            >
              <Text style={styles.nodeCompactNumber}>{day.session.session}</Text>
              {'  '}
              {day.session.title}
            </Text>
          ) : (
            <>
              <Text
                numberOfLines={reflow ? undefined : 1}
                style={[
                  styles.nodeMeta,
                  {
                    color: active
                      ? palette.accent
                      : completed
                        ? palette.success
                        : palette.textSecondary,
                  },
                ]}
              >
                {labels.session} {day.session.session} · {stateLabel}
                {day.dateLabel ? ` · ${day.dateLabel}` : ''}
              </Text>
              <Text
                numberOfLines={reflow ? undefined : 2}
                style={[
                  styles.nodeLabel,
                  active && styles.nodeLabelCurrent,
                  {
                    color: active
                      ? palette.text
                      : day.status === 'upcoming'
                        ? palette.textSecondary
                        : palette.text,
                  },
                ]}
              >
                {day.session.title}
              </Text>
            </>
          )}
        </View>
        {onPress && !compact ? (
          <Ionicons
            name="chevron-forward"
            size={LucidIcon.sm}
            color={active ? palette.accent : palette.textSecondary}
          />
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

function CurrentSessionCard({
  actionLabel,
  session,
  labels,
  loading,
  compact = false,
  objectiveNumberOfLines,
  reduceMotion,
  onPress,
}: {
  actionLabel: string;
  session: LucidProgramSession;
  labels: LucidJourneyLabels;
  loading: boolean;
  compact?: boolean;
  objectiveNumberOfLines?: number;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const palette = getLucidPalette(colors, 'dark');

  return (
    <View
      accessibilityLabel={`${labels.current}. ${session.title}. ${session.durationMinutes} ${labels.duration}. ${session.objective}`}
      style={[
        styles.currentCard,
        compact && styles.currentCardCompact,
        { backgroundColor: palette.backgroundDeep, borderColor: palette.borderInteractive },
      ]}
      testID="lucid-journey-current-card"
    >
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        cachePolicy="memory-disk"
        contentFit="cover"
        source={CURRENT_SESSION_ART}
        style={StyleSheet.absoluteFill}
        testID="lucid-journey-current-art"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.currentImageVeil,
          { backgroundColor: palette.backgroundDeep },
        ]}
      />
      <View
        pointerEvents="none"
        style={[styles.currentImageVeilLeft, { backgroundColor: palette.backgroundDeep }]}
      />
      <View
        pointerEvents="none"
        style={[styles.currentAccent, { backgroundColor: palette.accent }]}
      />
      <View style={styles.currentMetaRow}>
        <View style={[styles.currentPill, { backgroundColor: palette.accentSoft }]}>
          <Ionicons name="eye" size={LucidIcon.sm} color={palette.accent} />
          <Text style={[styles.currentPillLabel, { color: palette.accent }]}>
            {labels.current}
          </Text>
        </View>
        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={LucidIcon.sm} color={palette.textSecondary} />
          <Text style={[styles.duration, { color: palette.textSecondary }]}>
            {session.durationMinutes} {labels.duration}
          </Text>
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={[
          styles.currentTitle,
          compact && styles.currentTitleCompact,
          { color: palette.text },
        ]}
      >
        {session.title}
      </Text>
      {!compact ? (
        <Text
          numberOfLines={objectiveNumberOfLines}
          style={[styles.objective, { color: palette.textSecondary }]}
        >
          {session.objective}
        </Text>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={onPress}
        scale={reduceMotion ? 1 : LucidPress.scale}
        testID="lucid-journey-continue"
        style={[
          styles.cta,
          { backgroundColor: palette.accentStrong },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.backgroundDeep} />
        ) : (
          <>
            <Text style={[styles.ctaLabel, { color: palette.backgroundDeep }]}>
              {actionLabel}
            </Text>
            <Ionicons name="arrow-forward" size={LucidIcon.md} color={palette.backgroundDeep} />
          </>
        )}
      </PressableScale>
    </View>
  );
}

/**
 * Normalized anchors follow the luminous path in the 915 × 1719 source asset.
 * `left` is offset by roughly half the 56 dp marker so its centre, not its box,
 * sits on the route across 320–412 dp widths.
 */
type JourneyAnchor = Readonly<{ left: `${number}%`; top: number }>;

const JOURNEY_ANCHORS: Readonly<Record<number, JourneyAnchor>> = {
  7: { left: '38%', top: 0.185 },
  6: { left: '34%', top: 0.27 },
  5: { left: '39%', top: 0.36 },
  4: { left: '35%', top: 0.45 },
  3: { left: '33.5%', top: 0.54 },
  2: { left: '51%', top: 0.68 },
  1: { left: '24%', top: 0.82 },
};

function journeyAnchorForSession(session: number): JourneyAnchor {
  return JOURNEY_ANCHORS[session] ?? JOURNEY_ANCHORS[1];
}

function anchorForSession(session: number): ViewStyle {
  const anchor = journeyAnchorForSession(session);
  return { left: anchor.left, top: `${anchor.top * 100}%` };
}

function immersiveAnchorForSession(
  session: number,
  currentSession: number,
  naturalSceneHeight: number
): ViewStyle {
  const anchor = journeyAnchorForSession(session);
  return {
    left: anchor.left,
    top:
      naturalSceneHeight * anchor.top +
      (session < currentSession ? IMMERSIVE_CARD_GAP : 0),
  };
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    gap: LucidSpace.md,
    paddingBottom: LucidSpace.lg,
  },
  rootContained: {
    borderRadius: LucidRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rootImmersive: {
    borderWidth: 0,
    gap: 0,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  scene: { overflow: 'hidden' },
  sceneMap: { aspectRatio: JOURNEY_ASPECT_RATIO },
  sceneReflow: { padding: LucidSpace.lg },
  sceneImmersive: { overflow: 'hidden' },
  sceneImageClip: {
    position: 'absolute',
    right: 0,
    left: 0,
    overflow: 'hidden',
  },
  segmentedImage: { position: 'absolute', left: 0 },
  scrim: { backgroundColor: 'rgba(3, 11, 16, 0.24)' },
  header: {
    marginTop: LucidSpace.lg,
    marginHorizontal: LucidSpace.lg,
    borderRadius: LucidRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: LucidSpace.md,
    gap: LucidSpace.sm,
  },
  headerImmersive: {
    position: 'absolute',
    right: 0,
    left: 0,
    zIndex: 4,
    marginTop: 0,
    borderWidth: 0,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: 0,
    gap: 0,
  },
  headerImmersiveReflow: {
    marginTop: 0,
    marginHorizontal: 0,
    borderWidth: 0,
    padding: 0,
    paddingBottom: LucidSpace.md,
    gap: LucidSpace.xs,
  },
  headerTopRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LucidSpace.md,
  },
  headerTopRowImmersive: { minHeight: 44 },
  overline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progress: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.display[0],
    lineHeight: LucidType.display[1],
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: LucidSpace.lg,
  },
  progressRowImmersive: {
    minHeight: LucidType.h1[1],
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  progressImmersive: {
    fontSize: LucidType.h1[0],
    lineHeight: LucidType.h1[1],
  },
  progressMeter: { flex: 1, paddingBottom: LucidSpace.sm, gap: LucidSpace.sm },
  progressMeterImmersive: { paddingBottom: 0, gap: 0 },
  progressLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  progressSegments: { flexDirection: 'row', gap: LucidSpace.xs },
  progressSegment: { flex: 1, height: LucidSpace.xs, borderRadius: LucidRadius.full },
  path: { zIndex: 1 },
  pathMap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  pathReflow: { gap: LucidSpace.sm },
  currentCardMap: {
    position: 'absolute',
    right: LucidSpace.lg,
    left: LucidSpace.lg,
    zIndex: 3,
  },
  currentCardReflow: { marginTop: LucidSpace.md, zIndex: 2 },
  nodeRow: {
    minHeight: LucidSpace.xl * 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  nodeRowMap: {
    position: 'absolute',
    right: LucidSpace.sm,
    marginTop: -(LucidSpace.xl + LucidSpace.xs),
  },
  nodeRowReflow: { position: 'relative' },
  nodePressable: {
    minHeight: 48,
    alignSelf: 'stretch',
    borderRadius: LucidRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: LucidSpace.xs,
    paddingLeft: LucidSpace.xs,
    paddingRight: LucidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.sm,
  },
  nodePressableCurrent: { minHeight: LucidSpace.xl * 2 + LucidSpace.sm },
  nodeOrbFrame: {
    width: LucidSpace.xl * 2 + LucidSpace.sm,
    height: LucidSpace.xl * 2 + LucidSpace.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeHalo: {
    position: 'absolute',
    width: LucidSpace.xl * 2 + LucidSpace.lg,
    height: LucidSpace.xl * 2 + LucidSpace.lg,
    borderRadius: LucidRadius.full,
    borderWidth: 1,
    opacity: 0.5,
  },
  nodeOrb: {
    width: LucidSpace.gutter * 2,
    height: LucidSpace.gutter * 2,
    borderRadius: LucidRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeOrbCurrent: {
    width: LucidSpace.xl * 2 + LucidSpace.sm,
    height: LucidSpace.xl * 2 + LucidSpace.sm,
    borderWidth: 2,
  },
  nodeCopy: {
    flex: 1,
    borderRadius: LucidRadius.md,
    paddingHorizontal: LucidSpace.sm,
    paddingVertical: LucidSpace.xs,
    gap: LucidSpace.xs,
  },
  nodeCopyCompact: {
    paddingHorizontal: LucidSpace.xs,
    paddingVertical: 0,
    gap: 0,
  },
  nodeCompactLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  nodeCompactNumber: { fontFamily: 'SpaceGrotesk_700Bold' },
  nodeMeta: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    textTransform: 'uppercase',
  },
  nodeLabel: {
    flexShrink: 1,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  nodeLabelCurrent: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  dock: { paddingHorizontal: LucidSpace.lg, gap: LucidSpace.md },
  currentCard: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.sm,
    overflow: 'hidden',
  },
  currentCardCompact: {
    borderRadius: LucidRadius.lg,
    padding: LucidSpace.md,
    gap: LucidSpace.xs,
  },
  currentImageVeil: { opacity: 0.62 },
  currentImageVeilLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '62%',
    opacity: 0.4,
  },
  currentAccent: {
    position: 'absolute',
    top: 0,
    left: LucidSpace.xl,
    right: LucidSpace.xl,
    height: LucidSpace.xs,
    borderBottomLeftRadius: LucidRadius.full,
    borderBottomRightRadius: LucidRadius.full,
  },
  currentMetaRow: {
    minHeight: LucidSpace.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LucidSpace.md,
  },
  currentPill: {
    minHeight: LucidSpace.xl,
    borderRadius: LucidRadius.full,
    paddingHorizontal: LucidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.xs,
  },
  currentPillLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    textTransform: 'uppercase',
  },
  currentTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
  },
  currentTitleCompact: {
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm },
  duration: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  objective: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  cta: {
    minHeight: 48,
    borderRadius: LucidRadius.full,
    paddingHorizontal: LucidSpace.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LucidSpace.sm,
  },
  ctaLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  safety: {
    minHeight: 48,
    borderRadius: LucidRadius.lg,
    borderWidth: 1,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  safetyImmersive: {
    paddingHorizontal: LucidSpace.lg,
    paddingTop: LucidSpace.md,
  },
  safetyCopy: { flex: 1, gap: LucidSpace.xs },
  safetyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  safetyBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
});
