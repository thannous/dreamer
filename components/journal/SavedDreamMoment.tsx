import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import type { DreamTheme } from '@/lib/types';

import { DREAM_EASE, DREAM_STORY, entrance, paintSettle, paintSweep, twinkle } from './story/dreamStoryMotion';
import { sparklePath } from './story/sparkle';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');
/** Each theme's emblem, an ink mask the seal tints. */
export const SEAL_EMBLEMS: Record<DreamTheme, ImageSource> = {
  mystical: require('@/assets/images/dream-seal-emblem-mystical.webp'),
  calm: require('@/assets/images/dream-seal-emblem-calm.webp'),
  surreal: require('@/assets/images/dream-seal-emblem-surreal.webp'),
  noir: require('@/assets/images/dream-seal-emblem-noir.webp'),
  luminous: require('@/assets/images/dream-seal-emblem-luminous.webp'),
  nostalgic: require('@/assets/images/dream-seal-emblem-nostalgic.webp'),
};
/** The emblem is pressed in the warm light of the journal's lamp, in both themes. */
export const SEAL_GOLD = getNoctaliaPalette('dark').accent;
const EMBLEM = 92;
/** The legend runs between the window's rim and the astrolabe's inner orbit. */
const LEGEND_RADIUS = 84;
const LEGEND_LINE = 14;
const LEGEND_TRACKING = 1.6;
/** Past this arc the legend would wrap the window: it is left unengraved. */
const LEGEND_MAX_ARC = 4.2;
/** The signs on the astrolabe while the seal chooses, clockwise from the top, a sixth of a turn apart. */
const SIGNS = DREAM_THEMES;
const SIGN_STEP = 360 / SIGNS.length;
const SIGN = 28;
const SIGN_ORBIT = 104;

const MEDALLION = 148;
const ORBIT = 240;
/** The seal's measures, for the capture seal that strikes it before the page takes it over. */
export const SEAL_MEASURES = { medallion: MEDALLION, orbit: ORBIT, emblem: EMBLEM } as const;
const CENTER = ORBIT / 2;
const HALO_WIDTH = 340;
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

/** Where the dream is in its story: just saved, being read, or read. */
export type SavedDreamPhase = 'saved' | 'reading' | 'read';

/** What the seal is struck with: the emblem of the dream's theme, and its type and theme in words. */
export type SealMark = { theme: DreamTheme; legend: string };

/** Keyframe offsets are kept to a hundredth of a percent, so beats a few milliseconds apart stay apart. */
const percent = (value: number, total: number) => `${Math.round((value / total) * 10000) / 100}%`;

/**
 * The seal choosing: the signs a dream can bear appear on the astrolabe and turn while it
 * chooses. With a mark, the turn slows until its sign stands at the top, which glides into
 * the window and is pressed there; the others fade. Without one, the signs fade as they
 * turn and the seal stays plain. Its beats are given in milliseconds from its start: the
 * end of the turn (`choice`) and the moment the sign meets the window (`contact`). On the
 * page the sign changes from the page's ink to the lamp's gold as it glides over the night;
 * in the journal, whose ring still holds paper, it stays in ink.
 */
export function SealChoice({ mark, ink, choice, contact, gold = true }: {
  mark: SealMark | null;
  ink: string;
  choice: number;
  contact: number;
  gold?: boolean;
}) {
  const motion = useMemo(() => {
    const total = mark ? contact * 1.03 : choice;
    const at = (value: number) => percent(value, total);
    // A sliver of the story, so a change of state reads as a cut, not a fade.
    const cut = total * 0.004;
    const chosen = mark ? SIGNS.indexOf(mark.theme) : -1;
    const turn = mark ? -(360 + chosen * SIGN_STEP) : -200;
    const base = { animationDuration: total, animationFillMode: 'both' } as const;
    const turning = (sign: 1 | -1) => ({
      ...base,
      animationName: {
        '0%': { transform: [{ rotate: '0deg' }] },
        [at(choice)]: { transform: [{ rotate: `${sign * turn}deg` }] },
        '100%': { transform: [{ rotate: `${sign * turn}deg` }] },
      },
      animationTimingFunction: DREAM_EASE,
    }) as CSSStyle<ViewStyle>;
    const shown = choice * 0.23;
    const signs = SIGNS.map((_, index) => ({
      ...base,
      animationTimingFunction: 'ease-in-out',
      animationName: index === chosen ? {
        '0%': { opacity: 0 }, [at(shown)]: { opacity: 0.55 }, [at(choice * 0.87)]: { opacity: 0.55 },
        [at(choice)]: { opacity: 1 }, [at(choice + cut)]: { opacity: 0 }, '100%': { opacity: 0 },
      } : {
        '0%': { opacity: 0 }, [at(shown)]: { opacity: 0.55 },
        [at(mark ? choice : choice * 0.67)]: { opacity: 0.55 },
        [at(mark ? Math.min(choice * 1.2, contact) : choice)]: { opacity: 0 },
        '100%': { opacity: 0 },
      },
    }) as CSSStyle<ViewStyle>);
    const glide = { from: SIGN / EMBLEM, to: 1.1 };
    return {
      ring: turning(1),
      upright: turning(-1),
      signs,
      traveller: {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: {
          '0%': { opacity: 0, transform: [{ translateY: -SIGN_ORBIT }, { scale: glide.from }] },
          [at(choice)]: { opacity: 0, transform: [{ translateY: -SIGN_ORBIT }, { scale: glide.from }] },
          [at(choice + cut)]: { opacity: 1, transform: [{ translateY: -SIGN_ORBIT }, { scale: glide.from }] },
          [at(contact)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: glide.to }] },
          [at(contact + cut)]: { opacity: 0, transform: [{ translateY: 0 }, { scale: glide.to }] },
          '100%': { opacity: 0, transform: [{ translateY: 0 }, { scale: glide.to }] },
        },
      } as CSSStyle<ViewStyle>,
      inkFades: (gold ? {
        ...base,
        animationName: { '0%': { opacity: 1 }, [at(choice)]: { opacity: 1 }, [at(contact)]: { opacity: 0 }, '100%': { opacity: 0 } },
      } : null) as CSSStyle<ViewStyle> | null,
      goldRises: {
        ...base,
        animationName: { '0%': { opacity: 0 }, [at(choice)]: { opacity: 0 }, [at(contact)]: { opacity: 1 }, '100%': { opacity: 1 } },
      } as CSSStyle<ViewStyle>,
    };
  }, [choice, contact, gold, mark]);

  return (
    <>
      <Animated.View className="absolute left-0 top-0" style={[{ width: ORBIT, height: ORBIT }, motion.ring] as StyleProp<ViewStyle>}>
        {SIGNS.map((theme, index) => {
          const angle = (index * SIGN_STEP * Math.PI) / 180;
          return (
            <Animated.View key={theme} className="absolute" style={[{
              left: CENTER + SIGN_ORBIT * Math.sin(angle) - SIGN / 2,
              top: CENTER - SIGN_ORBIT * Math.cos(angle) - SIGN / 2,
              width: SIGN, height: SIGN,
            }, motion.upright] as StyleProp<ViewStyle>}>
              <Animated.View style={motion.signs[index] as StyleProp<ViewStyle>}>
                <Image source={SEAL_EMBLEMS[theme]} tintColor={ink} contentFit="contain" style={{ width: SIGN, height: SIGN }} />
              </Animated.View>
            </Animated.View>
          );
        })}
      </Animated.View>
      {mark ? (
        <Animated.View className="absolute" style={[{
          left: CENTER - EMBLEM / 2, top: CENTER - EMBLEM / 2, width: EMBLEM, height: EMBLEM,
        }, motion.traveller] as StyleProp<ViewStyle>}>
          <Animated.View className="absolute inset-0" style={motion.inkFades as StyleProp<ViewStyle>}>
            <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={ink} contentFit="contain" style={{ width: EMBLEM, height: EMBLEM }} />
          </Animated.View>
          {gold ? (
            <Animated.View className="absolute inset-0" style={motion.goldRises as StyleProp<ViewStyle>}>
              <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={SEAL_GOLD} contentFit="contain" style={{ width: EMBLEM, height: EMBLEM }} />
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </>
  );
}

/**
 * The legend engraved around the window, letter after letter from its start, centred on
 * the top of the seal. The letters are measured first, so each sits on the arc by its own
 * width.
 */
export function SealLegend({ text, reduced, from = DREAM_STORY.sealContact, still = false }: {
  text: string;
  reduced: boolean;
  /** When the engraving starts, in milliseconds. */
  from?: number;
  /** Already engraved, as the capture seal left it. */
  still?: boolean;
}) {
  const letters = useMemo(() => [...text.toUpperCase()].map((letter) => (letter === ' ' ? '\u00a0' : letter)), [text]);
  const glyphs = useMemo(() => [...new Set(letters)], [letters]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const measured = glyphs.every((glyph) => widths[glyph] !== undefined);

  const placed = useMemo(() => {
    if (!measured) return null;
    const total = letters.reduce((sum, letter) => sum + widths[letter], 0) + LEGEND_TRACKING * (letters.length - 1);
    if (total / LEGEND_RADIUS > LEGEND_MAX_ARC) return null;
    const step = Math.min(28, 520 / Math.max(letters.length - 1, 1));
    let along = -total / 2;
    return letters.map((letter, index) => {
      const width = widths[letter];
      const angle = (along + width / 2) / LEGEND_RADIUS;
      along += width + LEGEND_TRACKING;
      return {
        letter,
        width,
        left: CENTER + LEGEND_RADIUS * Math.sin(angle) - width / 2,
        top: CENTER - LEGEND_RADIUS * Math.cos(angle) - LEGEND_LINE / 2,
        angle,
        motion: (still ? null : reduced ? {
          animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
          animationDuration: 200,
          animationFillMode: 'both',
        } : {
          animationName: {
            from: { opacity: 0, transform: [{ scale: 0.4 }] },
            to: { opacity: 1, transform: [{ scale: 1 }] },
          },
          animationDuration: 260,
          animationDelay: from + 20 + index * step,
          animationTimingFunction: EASE.out,
          animationFillMode: 'both',
        }) as CSSStyle<ViewStyle>,
      };
    });
  }, [from, letters, measured, reduced, still, widths]);

  const letterClass = 'font-sans-medium text-[10px] text-champagne-on';
  return (
    <>
      {measured ? null : (
        <View className="absolute opacity-0" style={{ left: 0, top: 0 }}>
          {glyphs.map((glyph) => (
            <Text key={glyph} allowFontScaling={false} className={`absolute ${letterClass}`} style={{ lineHeight: LEGEND_LINE }}
              onLayout={({ nativeEvent: { layout } }) => setWidths((current) => ({ ...current, [glyph]: layout.width }))}>
              {glyph}
            </Text>
          ))}
        </View>
      )}
      {placed?.map((letter, index) => (
        <View key={index} className="absolute" style={{
          left: letter.left, top: letter.top, width: letter.width, height: LEGEND_LINE,
          transform: [{ rotate: `${letter.angle}rad` }],
        }}>
          <Animated.View style={letter.motion as StyleProp<ViewStyle>}>
            <Text allowFontScaling={false} className={letterClass} style={{ lineHeight: LEGEND_LINE }}>{letter.letter}</Text>
          </Animated.View>
        </View>
      ))}
    </>
  );
}

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
 */
export function SavedDreamMoment({ phase = 'saved', painting = false, handedOver = false, sealing = null, artwork = null, landArtwork = true, onOpenArtwork }: {
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
  /** The illustration has just landed: it settles once. Later mounts show it at rest. */
  landArtwork?: boolean;
  onOpenArtwork?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const reduced = useReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const dark = mode === 'dark';
  const accent = noctalia.accent.text;

  const motion = useMemo(() => ({
    halo: entrance(null, 1200, 0, reduced),
    orbit: entrance({ from: [{ rotate: '-24deg' }], to: [{ rotate: '0deg' }] }, 1400, 80, reduced),
    medallion: handedOver ? null : entrance({ from: [{ scale: 0.94 }], to: [{ scale: 1 }] }, 700, 0, reduced),
    label: entrance({ from: [{ translateY: 8 }], to: [{ translateY: 0 }] }, 400, 320, reduced),
  }), [handedOver, reduced]);
  const readingStars = useMemo(
    () => READING_STARS.map((_, index) => twinkle(index, READING_STARS.length, reduced)),
    [reduced]
  );
  const sweep = useMemo(() => paintSweep(MEDALLION, reduced), [reduced]);
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
  const settled = sealing?.settled === true;
  const struck = seal != null;
  useEffect(() => {
    if (!struck || settled || process.env.EXPO_OS === 'web') return;
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    }, reduced ? 0 : DREAM_STORY.sealContact);
    return () => clearTimeout(timer);
  }, [reduced, settled, struck]);
  const settle = useMemo(() => (landArtwork ? paintSettle(reduced) : null), [landArtwork, reduced]);

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
      {seal ? (
        <Animated.View testID="component.savedDream.sealEmblem" className="absolute" style={[{
          left: (MEDALLION - EMBLEM) / 2, top: (MEDALLION - EMBLEM) / 2, width: EMBLEM, height: EMBLEM,
        }, settled ? null : strike.emblem] as StyleProp<ViewStyle>}>
          <Image source={SEAL_EMBLEMS[seal.theme]} tintColor={SEAL_GOLD} contentFit="contain" style={{ width: EMBLEM, height: EMBLEM }} />
        </Animated.View>
      ) : null}
      {painting && !artwork ? (
        <Animated.View className="absolute" style={[{
          top: -MEDALLION * 0.25, left: MEDALLION * 0.25, width: MEDALLION * 0.5, height: MEDALLION * 1.5,
        }, sweep] as StyleProp<ViewStyle>}>
          <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            colors={[`${accent}00`, `${accent}59`, `${accent}00`]} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ) : null}
      {artwork ? (
        <Animated.View testID={TID.Component.SavedDreamArtwork} className="absolute inset-0"
          style={settle as StyleProp<ViewStyle>}>
          <Image source={artwork} contentFit="cover" style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ) : null}
      <Svg width={MEDALLION} height={MEDALLION} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
          stroke={accent} strokeOpacity={0.7} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );

  return (
    <View testID={TID.Component.SavedDreamMoment} className="mb-6 items-center">
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
              <View testID="component.savedDream.sealLegend" className="absolute left-0 top-0" style={{ width: ORBIT, height: ORBIT }}>
                <SealLegend text={seal.legend} reduced={reduced} still={settled} />
              </View>
            </>
          ) : null}
        </View>

        {artwork && onOpenArtwork ? (
          // Once painted, the window opens: pressing it shows the illustration full size.
          <PressableScale
            testID={TID.Button.SavedDreamArtworkOpen}
            onPress={onOpenArtwork}
            accessibilityRole="button"
            accessibilityLabel={t('journal.detail.image.expand_accessibility')}
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

      <Animated.View style={motion.label as StyleProp<ViewStyle>}>
        <Text
          testID={TID.Text.RecordingSaveConfirmation}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          className="mt-3 text-center font-sans-medium text-[12px] leading-[18px] uppercase tracking-[2px] text-champagne-on"
        >
          {t('recording.save.confirmation')}
        </Text>
      </Animated.View>
    </View>
  );
}
