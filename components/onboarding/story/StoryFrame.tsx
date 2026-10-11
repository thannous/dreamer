import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { WordReveal } from './StoryText';

/** Room kept under the scene for its subtitle. */
export const SUBTITLE_SPACE = 68;
/** The subtitle's word rhythm, shared with whoever waits for it to finish. */
export const SUBTITLE_STAGGER = 70;

/**
 * Where a scene plays: no frame of its own, it floats in the sheet's night. The
 * subtitle arrives once the scene has said its part.
 */
export function StoryFrame({ height, tokens, subtitle, subtitleDelay, sceneKey, children }: {
  height: number; tokens: NoctaliaDesignTokens; subtitle: string; subtitleDelay: number;
  sceneKey: string | number; children: ReactNode;
}) {
  return <View style={{ height }}>
    <View style={[styles.scene, { paddingBottom: SUBTITLE_SPACE }]}>{children}</View>
    <View key={sceneKey} style={styles.subtitle}>
      <WordReveal text={subtitle} delay={subtitleDelay} stagger={SUBTITLE_STAGGER}
        style={[styles.subtitleText, { color: tokens.illustration.text, textShadowColor: tokens.illustration.scrim }]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { position: 'absolute', left: 12, right: 12, bottom: 14 },
  subtitleText: {
    fontFamily: Fonts.spaceGrotesk.medium, fontSize: 17, lineHeight: 24, textAlign: 'center',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12,
  },
});
