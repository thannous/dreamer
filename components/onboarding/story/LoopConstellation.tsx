import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

import { STORY, reducedDelay } from './storyMotion';

export type LoopNode = {
  id: string;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  body: string;
};

export type LoopConstellationProps = {
  nodes: readonly LoopNode[];
  accent: string;
  text: string;
  muted: string;
  /** Play the ignition. False on a return visit: the loop is shown already lit. */
  play: boolean;
  /** Wraps each node, e.g. to make it pressable. Receives the rendered node. */
  renderNode?: (node: LoopNode, children: React.ReactNode) => React.ReactNode;
};

const NODE = 48;

/**
 * Raconter → Repérer → Relier, drawn as a constellation: the product loop told as a
 * picture rather than a feature list. Each star ignites in turn, the thread between
 * them draws itself, then one spark runs the whole line.
 *
 * Purpose: explanation. Seen once per install, so it lives in the delight budget, but it
 * never gates input and settles in about two seconds. Only opacity and transform move.
 */
export function LoopConstellation({ nodes, accent, text, muted, play, renderNode }: LoopConstellationProps) {
  const reduced = useReducedMotion();
  const count = nodes.length;

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.track} accessible={false}>
        {nodes.slice(0, -1).map((node, index) => (
          <Thread
            key={node.id}
            index={index}
            count={count}
            color={accent}
            play={play}
            reduced={reduced}
          />
        ))}
        {play && !reduced ? <Spark color={accent} count={count} /> : null}
      </View>
      {nodes.map((node, index) => {
        const content = (
          <NodeView
            node={node}
            index={index}
            accent={accent}
            text={text}
            muted={muted}
            play={play}
            reduced={reduced}
          />
        );
        return (
          <View key={node.id} style={styles.cell}>
            {renderNode ? renderNode(node, content) : content}
          </View>
        );
      })}
    </View>
  );
}

function NodeView({ node, index, accent, text, muted, play, reduced }: {
  node: LoopNode; index: number; accent: string; text: string; muted: string; play: boolean; reduced: boolean;
}) {
  const delay = STORY.node + index * STORY.nodeStep;
  const ignite = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: {
      '0%': { opacity: 0.2, transform: [{ scale: reduced ? 1 : 0.9 }] },
      '60%': { opacity: 1, transform: [{ scale: reduced ? 1 : 1.06 }] },
      '100%': { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: 520,
    animationDelay: reduced ? reducedDelay(delay) : delay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : {}), [delay, play, reduced]);
  const label = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: {
      from: { opacity: 0, transform: [{ translateY: reduced ? 0 : 6 }] },
      to: { opacity: 1, transform: [{ translateY: 0 }] },
    },
    animationDuration: STORY.arrive,
    animationDelay: reduced ? reducedDelay(delay) : delay + 120,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : {}), [delay, play, reduced]);

  return (
    <View style={styles.node}>
      <Animated.View style={[styles.star, { borderColor: accent }, ignite] as StyleProp<ViewStyle>}>
        <View style={[styles.starCore, { backgroundColor: accent }]} />
        <IconSymbol name={node.icon} size={20} color={accent} />
      </Animated.View>
      <Animated.View style={[styles.copy, label] as StyleProp<ViewStyle>}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.title, { color: text }]}
        >
          {node.title}
        </Text>
        <Text style={[styles.body, { color: muted }]}>{node.body}</Text>
      </Animated.View>
    </View>
  );
}

/** The line from one node to the next, drawn left to right as the next one ignites. */
function Thread({ index, count, color, play, reduced }: {
  index: number; count: number; color: string; play: boolean; reduced: boolean;
}) {
  const cell = 100 / count;
  const delay = STORY.node + index * STORY.nodeStep + 180;
  const draw = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: reduced
      ? { from: { opacity: 0 }, to: { opacity: 0.45 } }
      : {
          from: { opacity: 0.45, transform: [{ scaleX: 0 }] },
          to: { opacity: 0.45, transform: [{ scaleX: 1 }] },
        },
    animationDuration: STORY.thread,
    animationDelay: reduced ? reducedDelay(delay) : delay,
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  } : { opacity: 0.45 }), [delay, play, reduced]);

  return (
    <Animated.View
      style={[
        styles.thread,
        {
          backgroundColor: color,
          left: `${cell * index + cell / 2}%`,
          width: `${cell}%`,
        },
        draw,
      ] as StyleProp<ViewStyle>}
    />
  );
}

/** One spark that runs the whole loop once it is lit, then goes out. */
function Spark({ color, count }: { color: string; count: number }) {
  const cell = 100 / count;
  const travel = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      '0%': { opacity: 0, transform: [{ translateX: '0%' }] },
      '12%': { opacity: 1 },
      '88%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateX: '100%' }] },
    },
    animationDuration: STORY.sparkTravel,
    animationDelay: STORY.spark,
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  }), []);

  return (
    <View style={[styles.sparkLane, { left: `${cell / 2}%`, width: `${cell * (count - 1)}%` }]}>
      <Animated.View style={[styles.sparkRunner, travel] as StyleProp<ViewStyle>}>
        <View style={[styles.sparkGlow, { backgroundColor: color }]} />
        <View style={styles.sparkDot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 420, flexDirection: 'row', paddingTop: 12 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 12 },
  cell: { flex: 1, minWidth: 0 },
  node: { alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  star: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,4,13,0.55)',
  },
  starCore: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: NODE / 2, opacity: 0.08 },
  copy: { alignItems: 'center', gap: 3, alignSelf: 'stretch' },
  title: { fontFamily: Fonts.fraunces.medium, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  thread: { position: 'absolute', top: 4 + NODE / 2, height: StyleSheet.hairlineWidth * 2, transformOrigin: 'left' },
  sparkLane: { position: 'absolute', top: 4 + NODE / 2 - 6, height: 12 },
  sparkRunner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sparkGlow: { position: 'absolute', left: -9, top: -3, width: 18, height: 18, borderRadius: 9, opacity: 0.35 },
  sparkDot: { position: 'absolute', left: -3, top: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF9EF' },
});
