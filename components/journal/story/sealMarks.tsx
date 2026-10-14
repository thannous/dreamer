import React, { useMemo, useState } from 'react';
import { Image, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import type { DreamTheme } from '@/lib/types';

import { DREAM_EASE, DREAM_STORY } from './dreamStoryMotion';

/*
 * The seal a saved dream is struck with: the emblems of its themes, the signs turning on
 * the astrolabe while it chooses, and the legend engraved around its window. Shared by the
 * capture seal, which strikes it in the journal, and the saved moment, which shows it.
 */

/** Each theme's emblem, an ink mask the seal tints. */
export const SEAL_EMBLEMS: Record<DreamTheme, ImageSourcePropType> = {
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
                <Image source={SEAL_EMBLEMS[theme]} tintColor={ink} resizeMode="contain" style={{ width: SIGN, height: SIGN }} />
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
            <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={ink} resizeMode="contain" style={{ width: EMBLEM, height: EMBLEM }} />
          </Animated.View>
          {gold ? (
            <Animated.View className="absolute inset-0" style={motion.goldRises as StyleProp<ViewStyle>}>
              <Image source={SEAL_EMBLEMS[mark.theme]} tintColor={SEAL_GOLD} resizeMode="contain" style={{ width: EMBLEM, height: EMBLEM }} />
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
