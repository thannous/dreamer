import { Image, type ImageSource } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import {
  atlasFileUri,
  atlasPictureSources,
  coverRect,
  type AtlasLayer,
  type AtlasPicture,
  type SymbolAtlas,
} from '@/lib/symbolAtlas';

/** How long the textures move once their painting is there, then they rest. */
export const LIVING_ARRIVAL_MS = 2600;
const ARRIVAL_DELAY_MS = 150;

type LayerState = 'waiting' | 'arriving' | 'rest';
const PAINTING = 'painting';

/**
 * The site's motion (js/symbol-living) played once: each texture fades in and travels the
 * distance the site's own cycle covers in that time, ending where the painter placed it.
 * A pulse breathes once up to its brightest and settles. The site loops; here nothing runs
 * once it has settled, so a painting at rest costs no frame (owner decision 2026-10-20).
 */
function layerArrival(layer: AtlasLayer, width: number, height: number): CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>> {
  const [low, high] = layer.op;
  const rest = (low + high) / 2;
  const [dx, dy] = layer.move ?? [0, 0];
  // A flow crosses its whole range once per cycle, a drift half of it.
  const share = Math.min(1, LIVING_ARRIVAL_MS / 1000 / layer.dur) * (layer.motion === 'flow' ? 2 : 1);
  const animationName: CSSAnimationKeyframes<Pick<ViewStyle, 'opacity' | 'transform'>> = layer.motion === 'pulse'
    ? { from: { opacity: 0 }, '55%': { opacity: high }, to: { opacity: rest } }
    : {
      from: { opacity: 0, transform: [{ translateX: -dx * width * share }, { translateY: -dy * height * share }] },
      to: { opacity: rest, transform: [{ translateX: 0 }, { translateY: 0 }] },
    };
  return {
    animationName,
    animationDuration: LIVING_ARRIVAL_MS,
    animationDelay: ARRIVAL_DELAY_MS,
    animationTimingFunction: EASE.out,
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
  const arrival = useMemo(() => layerArrival(layer, width, height), [layer, width, height]);
  const rest = (layer.op[0] + layer.op[1]) / 2;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        { left: x * frame.width, top: y * frame.height, width, height },
        layer.blend ? { mixBlendMode: layer.blend } : null,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, state === 'arriving' ? arrival : { opacity: state === 'rest' ? rest : 0 }]}>
        <Image source={{ uri }} contentFit="fill" style={StyleSheet.absoluteFill} onLoad={() => onLoad(uri)} />
      </Animated.View>
    </View>
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
  /** Play the arrival once everything has loaded; otherwise the textures appear at rest. */
  arrive: boolean;
  placeholder?: ImageSource;
  transition?: number;
}

/**
 * A painting from the atlas with its two textures, covering its frame as the site shows it.
 * Mount it again (a new `key`) to replay the arrival.
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
  const state: LayerState = !ready ? 'waiting' : arrive && !reducedMotion ? 'arriving' : 'rest';

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
