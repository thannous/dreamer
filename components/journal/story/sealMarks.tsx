import { isLoaded } from 'expo-font';
import React, { useId, useMemo, useState } from 'react';
import { Image, Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import type { DreamTheme } from '@/lib/types';

import { DREAM_EASE, DREAM_STORY } from './dreamStoryMotion';
import { SEAL_EMBLEMS, SEAL_GOLD } from './sealEmblems';
import { sparklePath } from './sparkle';

/*
 * The seal a saved dream is struck with: the emblems of its themes, the signs turning on
 * the astrolabe while it chooses, and the legend engraved around its window. Shared by the
 * capture seal, which strikes it in the journal, and the saved moment, which shows it.
 */

export { SEAL_EMBLEMS, SEAL_GOLD };

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
/**
 * On a dream page that shows its seal, the name sits at the top of the page and keeps this
 * many lines above the seal, whatever its length, so the seal lies at the same place on
 * every such page: the capture seal can land on it before the name is known.
 */
export const SEAL_NAME_LINES = 3;
/** The text scales the dream page applies to its name and to its smaller lines. */
export const sealTextScales = (fontScale: number) => ({
  title: Math.min(1.4, Math.max(1, fontScale)),
  compact: Math.min(1.3, Math.max(1, fontScale)),
});
/**
 * The name's block above the seal, as the dream page lays it out: the lines kept for the
 * name and its margin, the line of the edit link and its margin, then the block's own.
 */
export const sealHeadingHeight = (fontScale: number) => {
  const scales = sealTextScales(fontScale);
  return SEAL_NAME_LINES * 32 * scales.title + 8 + 20 * scales.compact + 8 + 4;
};
const CENTER = ORBIT / 2;
/** What the seal is struck with: the emblem of the dream's theme, and its type and theme in words. */
export type SealMark = { theme: DreamTheme; legend: string };

/** Keyframe offsets are kept to a hundredth of a percent, so beats a few milliseconds apart stay apart. */
const percent = (value: number, total: number) => `${Math.round((value / total) * 10000) / 100}%`;

/** The track the signs ride while the seal chooses: a dotted orbit with the astrolabe's twelve marks. */
const TRACK_MARKS = 12;
/** The sparks the struck sign throws off as it meets the window. */
const SPARKS = 8;

/**
 * The seal choosing: a dotted orbit is inked around the window and the signs a dream can
 * bear come onto it one after another, each in its own small engraved medal, and turn
 * while the seal chooses. With a mark, the turn slows until its sign stands at the top; it
 * lifts in a warm glow while the others fade back, then glides into the window, trailing
 * its glow, and is pressed there, throwing off a few sparks. Without one, the signs and
 * their orbit fade as they turn and the seal stays plain. Its beats are given in
 * milliseconds from its start: the end of the turn (`choice`) and the moment the sign meets
 * the window (`contact`). On the page the sign turns from the page's ink to the lamp's gold
 * as it glides over the night; in the journal, whose ring still holds paper, it stays in
 * ink. The journal shows the signs larger and further out (`sign`, `orbit`), so they read
 * on its smaller page.
 */
export function SealChoice({ mark, ink, choice, contact, gold = true, orbit = SIGN_ORBIT, sign = SIGN }: {
  mark: SealMark | null;
  ink: string;
  choice: number;
  contact: number;
  gold?: boolean;
  orbit?: number;
  sign?: number;
}) {
  const medal = sign * 1.46;
  const motion = useMemo(() => {
    const burst = contact * 0.24;
    const total = mark ? contact + burst : choice;
    const at = (value: number) => percent(value, total);
    // A sliver of the story, so a change of state reads as a cut, not a fade.
    const cut = total * 0.004;
    const chosen = mark ? SIGNS.indexOf(mark.theme) : -1;
    const turn = mark ? -(360 + chosen * SIGN_STEP) : -200;
    const base = { animationDuration: total, animationFillMode: 'both' } as const;
    const turning = (direction: 1 | -1) => ({
      ...base,
      animationName: {
        '0%': { transform: [{ rotate: '0deg' }] },
        [at(choice)]: { transform: [{ rotate: `${direction * turn}deg` }] },
        '100%': { transform: [{ rotate: `${direction * turn}deg` }] },
      },
      animationTimingFunction: DREAM_EASE,
    }) as CSSStyle<ViewStyle>;
    const inked = choice * 0.18;
    const gone = mark ? Math.min(choice * 1.18, contact) : choice;
    // The signs come onto the orbit one after another, as it is inked.
    const signs = SIGNS.map((_, index) => {
      const from = inked * 0.4 + (choice * 0.22 * index) / SIGNS.length;
      const arrived = from + choice * 0.12;
      const still = { opacity: 0.78, transform: [{ scale: 1 }] };
      return {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: index === chosen ? {
          '0%': { opacity: 0, transform: [{ scale: 0.6 }] },
          [at(from)]: { opacity: 0, transform: [{ scale: 0.6 }] },
          [at(arrived)]: still,
          [at(choice * 0.84)]: still,
          // Chosen: it lifts, fully inked, before it leaves the orbit.
          [at(choice)]: { opacity: 1, transform: [{ scale: 1.28 }] },
          [at(choice + cut)]: { opacity: 0, transform: [{ scale: 1.28 }] },
          '100%': { opacity: 0, transform: [{ scale: 1.28 }] },
        } : {
          '0%': { opacity: 0, transform: [{ scale: 0.6 }] },
          [at(from)]: { opacity: 0, transform: [{ scale: 0.6 }] },
          [at(arrived)]: still,
          [at(mark ? choice : choice * 0.67)]: still,
          [at(gone)]: { opacity: 0, transform: [{ scale: 0.78 }] },
          '100%': { opacity: 0, transform: [{ scale: 0.78 }] },
        },
      } as CSSStyle<ViewStyle>;
    });
    const glide = { from: (sign * 1.28) / EMBLEM, to: 1.1 };
    const lifted = choice * 0.84;
    return {
      ring: turning(1),
      upright: turning(-1),
      signs,
      track: {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 0.94 }] },
          [at(inked)]: { opacity: 1, transform: [{ scale: 1 }] },
          [at(mark ? choice : choice * 0.67)]: { opacity: 1, transform: [{ scale: 1 }] },
          [at(gone)]: { opacity: 0, transform: [{ scale: 1.04 }] },
          '100%': { opacity: 0, transform: [{ scale: 1.04 }] },
        },
      } as CSSStyle<ViewStyle>,
      // The glow the chosen sign lifts in on the orbit, then trails into the window.
      lift: {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: {
          '0%': { opacity: 0 }, [at(lifted)]: { opacity: 0 }, [at(choice)]: { opacity: 1 },
          [at(choice + cut)]: { opacity: 0 }, '100%': { opacity: 0 },
        },
      } as CSSStyle<ViewStyle>,
      trail: {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: {
          '0%': { opacity: 0 }, [at(choice)]: { opacity: 0 }, [at(choice + cut)]: { opacity: 1 },
          [at(contact)]: { opacity: 0.6 }, [at(contact + burst * 0.6)]: { opacity: 0 }, '100%': { opacity: 0 },
        },
      } as CSSStyle<ViewStyle>,
      traveller: {
        ...base,
        animationTimingFunction: 'ease-in-out',
        animationName: {
          '0%': { opacity: 0, transform: [{ translateY: -orbit }, { scale: glide.from }] },
          [at(choice)]: { opacity: 0, transform: [{ translateY: -orbit }, { scale: glide.from }] },
          [at(choice + cut)]: { opacity: 1, transform: [{ translateY: -orbit }, { scale: glide.from }] },
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
      // Sparks thrown off at the contact, out past the rim, each a little differently.
      sparks: Array.from({ length: SPARKS }, (_, index) => {
        const angle = ((index + 0.5) / SPARKS) * Math.PI * 2;
        const reach = (index % 2 ? 0.82 : 0.96) * (EMBLEM * 0.9);
        const from = { x: Math.sin(angle) * EMBLEM * 0.42, y: -Math.cos(angle) * EMBLEM * 0.42 };
        const to = { x: Math.sin(angle) * reach, y: -Math.cos(angle) * reach };
        return {
          ...base,
          animationTimingFunction: EASE.out,
          animationName: {
            '0%': { opacity: 0, transform: [{ translateX: from.x }, { translateY: from.y }, { scale: 0.4 }] },
            [at(contact)]: { opacity: 0, transform: [{ translateX: from.x }, { translateY: from.y }, { scale: 0.4 }] },
            [at(contact + cut)]: { opacity: 1, transform: [{ translateX: from.x }, { translateY: from.y }, { scale: 1 }] },
            '100%': { opacity: 0, transform: [{ translateX: to.x }, { translateY: to.y }, { scale: 0.5 }] },
          },
        } as CSSStyle<ViewStyle>;
      }),
    };
  }, [choice, contact, gold, mark, orbit, sign]);

  const tint = gold ? SEAL_GOLD : ink;
  return (
    <>
      <Animated.View className="absolute left-0 top-0" style={[{ width: ORBIT, height: ORBIT }, motion.track] as StyleProp<ViewStyle>}>
        <Svg width={ORBIT} height={ORBIT}>
          <Circle cx={CENTER} cy={CENTER} r={orbit} fill="none" stroke={ink} strokeOpacity={0.58}
            strokeWidth={0.9} strokeDasharray="1.2 4.2" />
          {Array.from({ length: TRACK_MARKS }, (_, index) => {
            const angle = (index / TRACK_MARKS) * Math.PI * 2;
            const inner = orbit - (index % 3 ? 3 : 6);
            const outer = orbit + (index % 3 ? 3 : 6);
            return (
              <Path key={index} stroke={ink} strokeOpacity={0.62} strokeWidth={0.9} strokeLinecap="round"
                d={`M${CENTER + inner * Math.sin(angle)} ${CENTER - inner * Math.cos(angle)} L${CENTER + outer * Math.sin(angle)} ${CENTER - outer * Math.cos(angle)}`} />
            );
          })}
        </Svg>
      </Animated.View>
      <Animated.View className="absolute left-0 top-0" style={[{ width: ORBIT, height: ORBIT }, motion.ring] as StyleProp<ViewStyle>}>
        {SIGNS.map((theme, index) => {
          const angle = (index * SIGN_STEP * Math.PI) / 180;
          const chosen = mark?.theme === theme;
          return (
            <Animated.View key={theme} className="absolute items-center justify-center" style={[{
              left: CENTER + orbit * Math.sin(angle) - medal / 2,
              top: CENTER - orbit * Math.cos(angle) - medal / 2,
              width: medal, height: medal,
            }, motion.upright] as StyleProp<ViewStyle>}>
              {chosen ? (
                <Animated.View className="absolute" style={[{ width: medal * 2, height: medal * 2 }, motion.lift] as StyleProp<ViewStyle>}>
                  <Glow size={medal * 2} color={SEAL_GOLD} />
                </Animated.View>
              ) : null}
              <Animated.View className="items-center justify-center" style={[{ width: medal, height: medal }, motion.signs[index]] as StyleProp<ViewStyle>}>
                {/* Each sign in its own small engraved medal. */}
                <Svg width={medal} height={medal} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Circle cx={medal / 2} cy={medal / 2} r={medal / 2 - 0.8} fill="none" stroke={ink} strokeOpacity={0.72} strokeWidth={0.9} />
                  <Circle cx={medal / 2} cy={medal / 2} r={medal / 2 - 2.6} fill="none" stroke={ink} strokeOpacity={0.42}
                    strokeWidth={0.6} strokeDasharray="0.8 2.4" />
                </Svg>
                <Image source={SEAL_EMBLEMS[theme]} tintColor={ink} resizeMode="contain" style={{ width: sign, height: sign }} />
              </Animated.View>
            </Animated.View>
          );
        })}
      </Animated.View>
      {mark ? (
        <>
          <Animated.View className="absolute items-center justify-center" style={[{
            left: CENTER - EMBLEM / 2, top: CENTER - EMBLEM / 2, width: EMBLEM, height: EMBLEM,
          }, motion.traveller] as StyleProp<ViewStyle>}>
            <Animated.View className="absolute" style={[{ width: EMBLEM * 1.6, height: EMBLEM * 1.6 }, motion.trail] as StyleProp<ViewStyle>}>
              <Glow size={EMBLEM * 1.6} color={SEAL_GOLD} />
            </Animated.View>
            <Animated.View className="absolute inset-0" style={motion.inkFades as StyleProp<ViewStyle>}>
              <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={ink} resizeMode="contain" style={{ width: EMBLEM, height: EMBLEM }} />
            </Animated.View>
            {gold ? (
              <Animated.View className="absolute inset-0" style={motion.goldRises as StyleProp<ViewStyle>}>
                <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={SEAL_GOLD} resizeMode="contain" style={{ width: EMBLEM, height: EMBLEM }} />
              </Animated.View>
            ) : null}
          </Animated.View>
          {motion.sparks.map((spark, index) => (
            <Animated.View key={index} className="absolute" style={[{
              left: CENTER - 5, top: CENTER - 5, width: 10, height: 10,
            }, spark] as StyleProp<ViewStyle>}>
              <Svg width={10} height={10}><Path d={sparklePath(5, 5, 5)} fill={tint} /></Svg>
            </Animated.View>
          ))}
        </>
      ) : null}
    </>
  );
}

/** A soft round glow, strongest at its heart. */
function Glow({ size, color }: { size: number; color: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="0.5" stopColor={color} stopOpacity={0.18} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#glow${id})`} />
    </Svg>
  );
}

/** Each letter's last measured width: a legend drawn again sits on its arc at once. */
const glyphWidths = new Map<string, number>();
/** The face of the legend's letters (`font-sans-medium`). */
const LEGEND_FACE = 'SpaceGrotesk_500Medium';
/** Letters measured once their face had loaded: their widths no longer change. */
const settledGlyphs = new Set<string>();
/** Whether the legend's face has arrived: on the web, expo-font counts a face as loaded once declared. */
function legendFaceLoaded(): boolean {
  if (Platform.OS === 'web') return globalThis.document?.fonts?.check(`10px "${LEGEND_FACE}"`) ?? false;
  return isLoaded(LEGEND_FACE);
}

/**
 * The legend engraved around the window, letter after letter from its start, centred on
 * the top of the seal, or along its foot (`bottom`), where it reads upright from left to
 * right as on a postmark. The letters are measured first, so each sits on the arc by its
 * own width.
 */
export function SealLegend({ text, reduced, from = DREAM_STORY.sealContact, still = false, side = 'top' }: {
  text: string;
  reduced: boolean;
  /** When the engraving starts, in milliseconds. */
  from?: number;
  /** Already engraved, as the capture seal left it. */
  still?: boolean;
  side?: 'top' | 'bottom';
}) {
  const letters = useMemo(() => [...text.toUpperCase()].map((letter) => (letter === ' ' ? '\u00a0' : letter)), [text]);
  const glyphs = useMemo(() => [...new Set(letters)], [letters]);
  const [widths, setWidths] = useState<Record<string, number>>(() => Object.fromEntries(glyphs.flatMap((glyph) => {
    const width = glyphWidths.get(glyph);
    return width === undefined ? [] : [[glyph, width]];
  })));
  const measured = glyphs.every((glyph) => widths[glyph] !== undefined);
  // Still measured afresh, unseen, each time it is drawn, until measured in its own face:
  // should its font have loaded since, the letters move to their true widths.
  const [remeasured, setRemeasured] = useState<Record<string, true>>(() => Object.fromEntries(glyphs
    .filter((glyph) => settledGlyphs.has(glyph) && glyphWidths.has(glyph)).map((glyph) => [glyph, true])));
  const unmeasured = glyphs.filter((glyph) => !remeasured[glyph]);
  const measuring = unmeasured.length > 0;

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
      const foot = side === 'bottom';
      return {
        letter,
        width,
        left: CENTER + LEGEND_RADIUS * Math.sin(angle) - width / 2,
        top: CENTER + (foot ? 1 : -1) * LEGEND_RADIUS * Math.cos(angle) - LEGEND_LINE / 2,
        // Along the foot the letters lean the other way, their tops towards the window.
        angle: foot ? -angle : angle,
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
  }, [from, letters, measured, reduced, side, still, widths]);

  const letterClass = 'font-sans-medium text-[10px] text-champagne-on';
  return (
    <>
      {measuring ? (
        <View className="absolute opacity-0" style={{ left: 0, top: 0 }}>
          {unmeasured.map((glyph) => (
            <Text key={glyph} allowFontScaling={false} className={`absolute ${letterClass}`} style={{ lineHeight: LEGEND_LINE }}
              onLayout={({ nativeEvent: { layout } }) => {
                glyphWidths.set(glyph, layout.width);
                if (legendFaceLoaded()) settledGlyphs.add(glyph);
                setWidths((current) => (current[glyph] === layout.width ? current : { ...current, [glyph]: layout.width }));
                setRemeasured((current) => ({ ...current, [glyph]: true }));
              }}>
              {glyph}
            </Text>
          ))}
        </View>
      ) : null}
      {placed?.map((letter, index) => (
        <View key={index} className="absolute" style={{
          left: letter.left, top: letter.top, width: letter.width, height: LEGEND_LINE,
          transform: [{ rotate: `${letter.angle}rad` }],
        }}>
          {/* An engraved letter is drawn as it rests; only one being engraved moves. */}
          {letter.motion ? (
            <Animated.View style={letter.motion as StyleProp<ViewStyle>}>
              <Text allowFontScaling={false} className={letterClass} style={{ lineHeight: LEGEND_LINE }}>{letter.letter}</Text>
            </Animated.View>
          ) : (
            <Text allowFontScaling={false} className={letterClass} style={{ lineHeight: LEGEND_LINE }}>{letter.letter}</Text>
          )}
        </View>
      ))}
    </>
  );
}
