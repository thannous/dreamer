import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Image as Mark, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { useLiveTestID } from './DecorativeCopy';

import { DREAM_STORY, entrance, paintSettle, twinkle } from './story/dreamStoryMotion';
import { GlintedWords } from './story/GlintedWords';
import { PaintingCanvas } from './story/PaintingCanvas';
import {
  SEAL_EMBLEMS, SEAL_GOLD, SEAL_MEASURES, SealChoice, SealLegend, type SealMark,
} from './story/sealMarks';
import { sparklePath } from './story/sparkle';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');
const MEDALLION = SEAL_MEASURES.medallion;
const ORBIT = SEAL_MEASURES.orbit;
const CENTER = ORBIT / 2;
const EMBLEM = SEAL_MEASURES.emblem;
/** Keyframe offsets are kept to a hundredth of a percent, so beats a few milliseconds apart stay apart. */
const percent = (value: number, total: number) => `${Math.round((value / total) * 10000) / 100}%`;
const HALO_WIDTH = 340;
/** The line under the seal, which the capture seal lands the dream's name below. */
const WORDS_LINE = 18;
/** The line under the seal when it holds a step to take, drawn as a button. */
const STEP_LINE = 48;
const HALO_HEIGHT = 280;

// Fixed points so the sky is identical on every arrival and in screenshots.
const HALO_STARS = [
  { x: 52, y: 64, r: 1.3 },
  { x: 288, y: 48, r: 1.1 },
  { x: 304, y: 176, r: 1.5 },
  { x: 34, y: 196, r: 1 },
  { x: 250, y: 236, r: 0.9 },
  { x: 92, y: 250, r: 1.2 },
] as const;

/** The inner orbit's stars, which take turns while the dream is read and stay lit after. */
const READING_STARS = [-60, 0, 60, 120, 180, 240].map((degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + 94 * Math.cos(radians), y: CENTER + 94 * Math.sin(radians) };
});
const READING_STAR = 5;
/** The astrolabe's entrance has played by then: the orbit's, the longest, ends at 1480 ms. */
const ENTRANCE_MS = 1500;
/** After the seal's contact, the strike and the date engraved after it have played. */
const STRIKE_TAIL_MS = 1100;
/** After the seal's choice, its signs have faded when it found none to strike. */
const CHOICE_TAIL_MS = 300;

/** Where the dream is in its story: just saved, being read, or read. */
export type { SealMark };

export type SavedDreamPhase = 'saved' | 'reading' | 'read';

/**
 * What the seal offers under it: the dream's reading, or the step that opens it, and while
 * the dream is read, that it is. Pressing the seal or its words takes the step.
 */
export type SavedDreamAction = {
  label: string;
  icon?: ComponentProps<typeof IconSymbol>['name'] | null;
  /** Absent while the dream is being read: the words only say so. */
  onPress?: () => void;
  disabled?: boolean;
  /** What pressing costs or opens, for assistive technologies. */
  hint?: string | null;
  testID?: string;
  /**
   * A step to take is drawn as a button under the seal: filled when it is the page's
   * next step, outlined when the page offers its next step elsewhere. Without it the
   * words only say where the dream is.
   */
  emphasis?: 'primary' | 'secondary';
};

/**
 * The moment a captured dream lands in the journal: a window onto the night sky held
 * in an astrolabe, which settles into alignment once. It appears only on the arrival
 * from capture, so the motion budget of a success state is spent at most once per dream.
 * While the dream is read (Act II) the inner orbit's stars take turns, and they stay lit
 * once the reading has landed. While its illustration is made (Act III) a band of light
 * crosses the window; once painted, the dream's own image settles into it and the
 * medallion opens the full view. Under reduced motion the layers only fade in and the
 * looping stars and light hold still. Arriving from the capture seal, which ends on this
 * window already open, the window stays put and only the astrolabe settles around it.
 * The struck seal says the dream is saved, so the words under it offer the next step
 * instead (`action`), and the seal itself takes it; the save is still announced to
 * assistive technologies (`announce`). Its rim carries the dream's details: what it is
 * along the top, its date along the foot. On a dream page opened again it is drawn at
 * rest (`still`), at the head of the dream's reading.
 */
export function SavedDreamMoment({
  phase = 'saved', painting = false, handedOver = false, sealing = null, artwork = null, landArtwork = true,
  onOpenArtwork, onArtworkError, onArtworkDisplay, action = null, date = null, still = false, announce = false, wordsLine = true,
  artworkAway = false,
}: {
  phase?: SavedDreamPhase;
  /**
   * The seal choosing, then struck with what the dream is when its pre-analysis has said
   * it; or, `settled`, already struck by the capture seal and shown as it was left.
   */
  sealing?: { mark: SealMark | null; settled?: boolean } | null;
  /** The capture seal has just shown this window: it is taken over rather than opened again. */
  handedOver?: boolean;
  /** The illustration job is running: the window is being painted. */
  painting?: boolean;
  /** The dream's own illustration, once it has landed. */
  artwork?: ImageSource | null;
  /** The illustration has left the window for the page's plate: the night shows through again. */
  artworkAway?: boolean;
  /** The illustration has just landed: it settles once. Later mounts show it at rest. */
  landArtwork?: boolean;
  onOpenArtwork?: () => void;
  /** The illustration could not be shown in the window. */
  onArtworkError?: () => void;
  onArtworkDisplay?: () => void;
  action?: SavedDreamAction | null;
  /** The dream's date, engraved along the foot of the rim. */
  date?: string | null;
  /** Drawn at rest: nothing enters. */
  still?: boolean;
  /** Just saved: the save is announced to assistive technologies. */
  announce?: boolean;
  /** The line under the seal is kept even without words, so what follows does not move when they come. */
  wordsLine?: boolean;
}) {
  const { t } = useTranslation();
  const tid = useLiveTestID();
  const announced = useRef(false);
  useEffect(() => {
    if (!announce || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility?.(t('recording.save.confirmation'));
  }, [announce, t]);
  const { colors, mode } = useTheme();
  const reduced = useReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const dark = mode === 'dark';
  const accent = noctalia.accent.text;

  // Once come in, the astrolabe stays as it is: when a view holding it is rebuilt (a step
  // offered or taken, the illustration landing), its entrance does not play again.
  const [entered, setEntered] = useState(still);
  useEffect(() => {
    if (entered) return;
    const timer = setTimeout(() => setEntered(true), ENTRANCE_MS);
    return () => clearTimeout(timer);
  }, [entered]);
  const motion = useMemo(() => (still || entered ? { halo: null, orbit: null, medallion: null } : {
    halo: entrance(null, 1200, 0, reduced),
    orbit: entrance({ from: [{ rotate: '-24deg' }], to: [{ rotate: '0deg' }] }, 1400, 80, reduced),
    medallion: handedOver ? null : entrance({ from: [{ scale: 0.94 }], to: [{ scale: 1 }] }, 700, 0, reduced),
  }), [entered, handedOver, reduced, still]);
  // The words under the seal still enter afresh with each step they offer.
  const labelMotion = useMemo(
    () => (still ? null : entrance({ from: [{ translateY: 8 }], to: [{ translateY: 0 }] }, 400, 320, reduced)),
    [reduced, still]
  );
  const readingStars = useMemo(
    () => READING_STARS.map((_, index) => twinkle(index, READING_STARS.length, reduced)),
    [reduced]
  );
  // The strike: the chosen sign meets the window and is pressed into it; the sky dims a
  // little under it, so the mark reads over the night, and the rim's ink spreads once.
  const strike = useMemo(() => {
    const contact = reduced ? 0 : DREAM_STORY.sealContact;
    const total = contact + 720;
    const at = (value: number) => percent(value, total);
    const base = { animationDuration: total, animationFillMode: 'both' } as const;
    return {
      emblem: (reduced ? {
        animationName: { from: { opacity: 0 }, to: { opacity: 1 } }, animationDuration: 240, animationFillMode: 'both',
      } : {
        ...base,
        animationTimingFunction: EASE.out,
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 1.1 }] },
          [at(contact)]: { opacity: 0, transform: [{ scale: 1.1 }] },
          [at(contact + 12)]: { opacity: 1, transform: [{ scale: 1.1 }] },
          [at(contact + 130)]: { opacity: 1, transform: [{ scale: 0.94 }] },
          [at(contact + 380)]: { opacity: 1, transform: [{ scale: 1 }] },
          '100%': { opacity: 1, transform: [{ scale: 1 }] },
        },
      }) as CSSStyle<ViewStyle>,
      wash: {
        ...base,
        animationTimingFunction: EASE.out,
        animationName: {
          '0%': { opacity: 0 }, [at(Math.max(0, contact - 150))]: { opacity: 0 },
          [at(contact + 150)]: { opacity: 0.32 }, '100%': { opacity: 0.32 },
        },
      } as CSSStyle<ViewStyle>,
      ripple: (reduced ? { opacity: 0 } : {
        ...base,
        animationTimingFunction: EASE.out,
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 1 }] },
          [at(contact)]: { opacity: 0, transform: [{ scale: 1 }] },
          [at(contact + 12)]: { opacity: 0.6, transform: [{ scale: 1 }] },
          '100%': { opacity: 0, transform: [{ scale: 1.24 }] },
        },
      }) as CSSStyle<ViewStyle>,
    };
  }, [reduced]);
  const seal = sealing?.mark ?? null;
  const struckBefore = sealing?.settled === true;
  const struck = seal != null;
  useEffect(() => {
    if (!struck || struckBefore || process.env.EXPO_OS === 'web') return;
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    }, reduced ? 0 : DREAM_STORY.sealContact);
    return () => clearTimeout(timer);
  }, [reduced, struckBefore, struck]);
  // The seal's choice and its strike play once too: once over, the seal shows them as they
  // were left, struck and engraved, or plain.
  const [ceremonyLeft, setCeremonyLeft] = useState(false);
  useEffect(() => {
    if (!sealing || struckBefore || ceremonyLeft) return;
    const timer = setTimeout(() => setCeremonyLeft(true), struck
      ? (reduced ? 0 : DREAM_STORY.sealContact) + STRIKE_TAIL_MS
      : DREAM_STORY.sealChoice + CHOICE_TAIL_MS);
    return () => clearTimeout(timer);
  }, [ceremonyLeft, reduced, sealing, struckBefore, struck]);
  const settled = struckBefore || ceremonyLeft;
  const settle = useMemo(() => (landArtwork ? paintSettle(reduced) : null), [landArtwork, reduced]);
  const canvas = painting && !artwork;

  const medallion = (
    <Animated.View
      className="overflow-hidden rounded-full bg-ink"
      style={[{ width: MEDALLION, height: MEDALLION }, motion.medallion] as StyleProp<ViewStyle>}
    >
      <Image source={ASTRAL_ART} contentFit="cover" contentPosition="center" style={{ width: '100%', height: '100%' }} />
      {seal ? (
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-black"
          style={(settled ? { opacity: 0.32 } : strike.wash) as StyleProp<ViewStyle>} />
      ) : null}
      {/* While the window is painted it is a canvas: the struck sign gives way to the brush. */}
      {seal && !canvas ? (
        <Animated.View testID={tid('component.savedDream.sealEmblem')} className="absolute" style={[{
          left: (MEDALLION - EMBLEM) / 2, top: (MEDALLION - EMBLEM) / 2, width: EMBLEM, height: EMBLEM,
        }, settled ? null : strike.emblem] as StyleProp<ViewStyle>}>
          <Mark source={SEAL_EMBLEMS[seal.theme]} tintColor={SEAL_GOLD} resizeMode="contain" style={{ width: EMBLEM, height: EMBLEM }} />
        </Animated.View>
      ) : null}
      {canvas ? <PaintingCanvas testID={tid(TID.Component.SavedDreamPainting)} travel={MEDALLION} ink={SEAL_GOLD} brush={32} /> : null}
      {artwork ? (
        // Kept in place once gone, only unseen: the window does not change what it holds.
        <View collapsable={false} className="absolute inset-0" style={{ opacity: artworkAway ? 0 : 1 }}>
          <Animated.View testID={tid(TID.Component.SavedDreamArtwork)} className="absolute inset-0"
            style={settle as StyleProp<ViewStyle>}>
            <Image source={artwork} contentFit="cover" style={{ width: '100%', height: '100%' }} onError={onArtworkError} onDisplay={onArtworkDisplay} />
          </Animated.View>
        </View>
      ) : null}
      <Svg width={MEDALLION} height={MEDALLION} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
          stroke={accent} strokeOpacity={0.7} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );

  const takeStep = action?.onPress && !action.disabled ? action.onPress : undefined;
  // What the rim says, for assistive technologies: the rim itself is drawn, not read.
  const details = [seal?.legend, date].filter(Boolean).join(', ');
  const astrolabe = (
    <View className="items-center justify-center" style={{ width: ORBIT, height: ORBIT }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
      >
        <Animated.View
          className="absolute"
          style={[{ width: HALO_WIDTH, height: HALO_HEIGHT }, motion.halo] as StyleProp<ViewStyle>}
        >
          <Svg width={HALO_WIDTH} height={HALO_HEIGHT}>
            <Defs>
              <RadialGradient id="savedDreamHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={noctalia.atmosphere.glow} stopOpacity={dark ? 0.24 : 0.16} />
                <Stop offset="55%" stopColor={noctalia.atmosphere.glow} stopOpacity={dark ? 0.07 : 0.05} />
                <Stop offset="100%" stopColor={noctalia.atmosphere.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={HALO_WIDTH / 2} cy={HALO_HEIGHT / 2} rx={HALO_WIDTH / 2} ry={HALO_HEIGHT / 2} fill="url(#savedDreamHalo)" />
            {HALO_STARS.map((star) => (
              <Circle key={`${star.x}:${star.y}`} cx={star.x} cy={star.y} r={star.r} fill={noctalia.atmosphere.star} />
            ))}
          </Svg>
        </Animated.View>

        <Animated.View
          className="absolute"
          style={[{ width: ORBIT, height: ORBIT }, motion.orbit] as StyleProp<ViewStyle>}
        >
          <Svg width={ORBIT} height={ORBIT}>
            <Circle cx={CENTER} cy={CENTER} r={94} fill="none" stroke={accent} strokeOpacity={0.34} strokeWidth={0.75} />
            <Circle cx={CENTER} cy={CENTER} r={110} fill="none" stroke={accent} strokeOpacity={0.26}
              strokeWidth={0.75} strokeDasharray="1.5 5" />
            <Circle cx={210} cy={57} r={2.2} fill={accent} />
            <Circle cx={31.6} cy={87.8} r={1.6} fill={accent} fillOpacity={0.8} />
            <Circle cx={29.9} cy={183.1} r={1.4} fill={accent} fillOpacity={0.7} />
            <Circle cx={CENTER} cy={CENTER + 110} r={7} fill="none" stroke={accent} strokeOpacity={0.4} strokeWidth={0.75} />
            <Path d={sparklePath(CENTER, CENTER + 110, 10)} fill={accent} />
          </Svg>
          {phase === 'saved' ? null : READING_STARS.map((star, index) => (
            <Animated.View
              key={index}
              className="absolute rounded-full bg-champagne"
              style={[{
                left: star.x - READING_STAR / 2,
                top: star.y - READING_STAR / 2,
                width: READING_STAR,
                height: READING_STAR,
              }, phase === 'reading' ? readingStars[index] : null] as StyleProp<ViewStyle>}
            />
          ))}
        </Animated.View>
        {seal ? (
          <>
            {settled ? null : (
              <Animated.View className="absolute rounded-full" style={[{
                width: MEDALLION, height: MEDALLION, borderWidth: 1.5, borderColor: accent,
              }, strike.ripple] as StyleProp<ViewStyle>} />
            )}
            <View testID={tid('component.savedDream.sealLegend')} className="absolute left-0 top-0" style={{ width: ORBIT, height: ORBIT }}>
              <SealLegend text={seal.legend} reduced={reduced} still={settled || still} />
            </View>
          </>
        ) : null}
        {date ? (
          <View testID={tid('component.savedDream.sealDate')} className="absolute left-0 top-0" style={{ width: ORBIT, height: ORBIT }}>
            <SealLegend text={date} side="bottom" reduced={reduced} still={settled || still || (entered && !struck)}
              from={seal && !settled ? DREAM_STORY.sealContact + 240 : 320} />
          </View>
        ) : null}
      </View>

      {artwork && onOpenArtwork && !action ? (
        // Once painted, the window opens: pressing it shows the illustration full size. Once
        // the illustration has left for the plate, the same view stays, only no longer pressed.
        <PressableScale
          testID={tid(TID.Button.SavedDreamArtworkOpen)}
          onPress={artworkAway ? undefined : onOpenArtwork}
          disabled={artworkAway}
          accessibilityRole="button"
          accessibilityLabel={t('journal.detail.image.expand_accessibility')}
          accessibilityElementsHidden={artworkAway}
          importantForAccessibility={artworkAway ? 'no-hide-descendants' : 'auto'}
          className="rounded-full"
        >
          {medallion}
        </PressableScale>
      ) : (
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          pointerEvents="none">
          {medallion}
        </View>
      )}
      {sealing && !settled && !reduced ? (
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          pointerEvents="none" className="absolute left-0 top-0" style={{ width: ORBIT, height: ORBIT }}>
          <SealChoice mark={seal} ink={accent} choice={DREAM_STORY.sealChoice} contact={DREAM_STORY.sealContact} />
        </View>
      ) : null}
    </View>
  );
  // One line, always kept, so the page under the seal holds still as the step changes (unless
  // a long step wraps); keyed, so the words enter afresh when the step they offer appears or
  // changes.
  const primaryStep = action?.emphasis === 'primary';
  const words = !wordsLine && !action ? null : (
    <View className="mt-3 items-center justify-center"
      style={{ minHeight: wordsLine || action?.emphasis ? STEP_LINE : WORDS_LINE }}>
      {primaryStep && action ? (
        // The page's next step: its words in the book's type, catching the light.
        <Animated.View key={action.label} style={labelMotion as StyleProp<ViewStyle>}
          className={`flex-row items-center justify-center gap-2 px-2 py-2.5 ${action.disabled ? 'opacity-60' : ''}`}>
          {action.icon ? <IconSymbol name={action.icon} size={18} color={accent} /> : null}
          <GlintedWords testID={tid(TID.Text.DreamDetailActionTitle)} accessibilityLiveRegion="polite"
            light={noctalia.atmosphere.sheen} glow={`${accent}${dark ? '73' : '00'}`}
            className="text-center font-display-medium text-[21px] leading-[28px] text-champagne-on">
            {action.label}
          </GlintedWords>
        </Animated.View>
      ) : action?.emphasis ? (
        <Animated.View key={action.label} style={labelMotion as StyleProp<ViewStyle>}
          className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-champagne px-6 py-2.5 ${
            action.disabled ? 'opacity-60' : ''}`}>
          {action.icon ? <IconSymbol name={action.icon} size={18} color={accent} /> : null}
          <Text testID={tid(TID.Text.DreamDetailActionTitle)} accessibilityLiveRegion="polite"
            className="shrink text-center font-sans-bold text-[15px] leading-[20px] text-champagne-on">
            {action.label}
          </Text>
        </Animated.View>
      ) : action ? (
        <Animated.View key={action.label} style={labelMotion as StyleProp<ViewStyle>}
          className={`flex-row items-center gap-1.5 ${action.disabled ? 'opacity-60' : ''}`}>
          {action.icon ? <IconSymbol name={action.icon} size={14} color={accent} /> : null}
          <Text testID={tid(TID.Text.DreamDetailActionTitle)} accessibilityLiveRegion="polite" numberOfLines={1}
            className="shrink text-center font-sans-medium text-[12px] leading-[18px] uppercase tracking-[2px] text-champagne-on">
            {action.label}
          </Text>
          {action.onPress && !action.disabled ? <IconSymbol name="chevron.right" size={12} color={accent} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View testID={tid(TID.Component.SavedDreamMoment)} className="mb-6 items-center">
      {action?.onPress ? (
        <PressableScale testID={tid(action.testID)} onPress={takeStep} disabled={!takeStep} haptic="light"
          accessibilityRole="button" accessibilityLabel={action.label} accessibilityHint={action.hint ?? undefined}
          accessibilityValue={details ? { text: details } : undefined}
          accessibilityState={{ disabled: !takeStep }} className="items-center">
          {astrolabe}
          {words}
        </PressableScale>
      ) : (
        <>
          {/* Grouped only while the window holds no button of its own to press. */}
          {details && !(artwork && onOpenArtwork)
            ? <View accessible accessibilityRole="text" accessibilityLabel={details}>{astrolabe}</View>
            : astrolabe}
          {words}
        </>
      )}
    </View>
  );
}
