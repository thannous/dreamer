import { Image, type ImageSource } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';

import {
  atlasFileUri,
  atlasPictureSources,
  coverRect,
  type AtlasLayer,
  type AtlasPicture,
  type SymbolAtlas,
} from '@/lib/symbolAtlas';

/** How long a painting lives once it is there, then it settles. */
export const LIVING_MS = 9000;
// The textures appear as the site's stage does, over its own fade.
const APPEAR = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: 800,
  animationTimingFunction: 'ease',
  animationFillMode: 'both',
} as const;

type LayerState = 'waiting' | 'living' | 'rest';
const PAINTING = 'painting';
type Motion = CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>>;

/**
 * The site's own motion (js/symbol-living) for LIVING_MS: the same keyframes, curves and
 * directions, as many whole cycles as fit, each stretched a little so they end together.
 * Like the site, each copy starts partway through its cycle, the first one halfway, where
 * the painter placed it; it stops there again, so the painting settles exactly as the
 * resting frame shows it. The site loops; here nothing runs once it has settled, so a
 * painting at rest costs no frame (owner decisions 2026-10-20: 9 s, then rest).
 */
function layerMotion(layer: AtlasLayer, width: number, height: number, copy: number, copies: number): Motion {
  const [low, high] = layer.op;
  const [dx, dy] = layer.move ?? [0, 0];
  // A share of a cycle: 0 is its start, 1 its end.
  const at = (share: number) => [{ translateX: (2 * share - 1) * dx * width }, { translateY: (2 * share - 1) * dy * height }];
  const cycles = Math.max(1, Math.round(LIVING_MS / 1000 / layer.dur));
  const cycle = LIVING_MS / cycles;
  const phase = 0.5 + copy / copies;
  const animationName: CSSAnimationKeyframes<Pick<ViewStyle, 'opacity' | 'transform'>> = layer.motion === 'pulse'
    ? { from: { opacity: low }, to: { opacity: high } }
    : layer.motion === 'flow'
      ? {
        '0%': { opacity: 0, transform: at(0) },
        '18%': { opacity: high, transform: at(0.18) },
        '50%': { opacity: (low + high) / 2, transform: at(0.5) },
        '82%': { opacity: high, transform: at(0.82) },
        '100%': { opacity: 0, transform: at(1) },
      }
      : { from: { opacity: low, transform: at(0) }, to: { opacity: high, transform: at(1) } };
  return {
    animationName,
    animationDuration: cycle,
    animationDelay: -phase * cycle,
    animationIterationCount: cycles + phase,
    animationDirection: layer.motion === 'flow' ? 'normal' : 'alternate',
    animationTimingFunction: layer.motion === 'flow' ? 'linear' : 'ease-in-out',
    animationFillMode: 'both',
  };
}

function Layer({ uri, layer, frame, state, onLoad }: {
  uri: string;
  layer: AtlasLayer;
  frame: { width: number; height: number };
  state: LayerState;
  onLoad: (key: string) => void;
}) {
  const [x, y, w, h] = layer.box;
  const width = w * frame.width;
  const height = h * frame.height;
  // A flow shows its copies while it lives; at rest only the first, halfway through.
  const copies = state === 'living' && layer.motion === 'flow' ? Math.max(1, layer.copies ?? 1) : 1;
  const motions = useMemo(
    () => Array.from({ length: copies }, (_, copy) => layerMotion(layer, width, height, copy, copies)),
    [copies, layer, width, height],
  );
  const rest = (layer.op[0] + layer.op[1]) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        { left: x * frame.width, top: y * frame.height, width, height },
        layer.blend ? { mixBlendMode: layer.blend } : null,
        state === 'living' ? APPEAR : null,
      ]}
    >
      {motions.map((motion, copy) => (
        <Animated.View
          key={copy}
          style={[StyleSheet.absoluteFill, state === 'living' ? motion : { opacity: state === 'rest' ? rest : 0 }]}
        >
          <Image source={{ uri }} contentFit="fill" style={StyleSheet.absoluteFill} onLoad={copy === 0 ? () => onLoad(uri) : undefined} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

interface LivingPaintingProps {
  atlas: SymbolAtlas;
  /** The symbol whose folder holds the files. */
  symbolId: string;
  picture: AtlasPicture;
  /** CSS object-position of the painting in its frame. */
  position?: string;
  layers: AtlasLayer[];
  /** The frame the painting covers. */
  frame: { width: number; height: number };
  /** Bring the painting to life for LIVING_MS once everything has loaded; otherwise the textures appear at rest. */
  arrive: boolean;
  placeholder?: ImageSource;
  transition?: number;
}

/**
 * A painting from the atlas with its two textures, covering its frame as the site shows it.
 * Mount it again (a new `key`) to bring it to life again.
 */
export function LivingPainting({ atlas, symbolId, picture, position, layers, frame, arrive, placeholder, transition }: LivingPaintingProps) {
  const reducedMotion = useReducedMotion();
  const rect = useMemo(() => coverRect(frame, picture, position), [frame, picture, position]);
  const sources = useMemo(() => atlasPictureSources(atlas, symbolId, picture), [atlas, symbolId, picture]);
  // The textures wait for the painting and for each other, so they arrive together on it.
  // expo-image may report a load again (a sharper width), so each file counts once.
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const markLoaded = useCallback((key: string) => {
    setLoaded((current) => (current.has(key) ? current : new Set(current).add(key)));
  }, []);
  const ready = loaded.has(PAINTING) && layers.every((layer) => loaded.has(atlasFileUri(atlas, symbolId, layer.file)));
  const state: LayerState = !ready ? 'waiting' : arrive && !reducedMotion ? 'living' : 'rest';

  return (
    <View pointerEvents="none" style={[styles.stage, rect]}>
      <Image
        source={sources}
        placeholder={placeholder}
        placeholderContentFit="cover"
        contentFit="fill"
        transition={transition}
        style={StyleSheet.absoluteFill}
        onLoad={() => markLoaded(PAINTING)}
      />
      {layers.map((layer, index) => (
        <Layer
          key={`${layer.file}-${index}`}
          uri={atlasFileUri(atlas, symbolId, layer.file)}
          layer={layer}
          frame={rect}
          state={state}
          onLoad={markLoaded}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute', overflow: 'hidden' },
  layer: { position: 'absolute', overflow: 'hidden' },
});
