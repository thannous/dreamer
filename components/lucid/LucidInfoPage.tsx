import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { LucidCard, LucidIconAction, LucidIconTile, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

export type LucidInfoSection = { title: string; body?: string; bullets?: readonly string[]; link?: { label: string; url: string } };

export function LucidInfoPage({ eyebrow, title, subtitle, icon, sections }: { eyebrow?: string; title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; sections: readonly LucidInfoSection[] }) {
  const { colors, mode } = useTheme(); const palette = getLucidPalette(colors, mode); const { content } = useLucidTrainer();
  return <LucidScreen eyebrow={eyebrow} title={title} subtitle={subtitle} trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={() => router.back()} />}>
    <LucidCard accent="accent"><View style={styles.hero}><LucidIconTile icon={icon} tone="accent" size="lg" /></View></LucidCard>
    {sections.map((section) => <LucidCard key={section.title}><Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{section.title}</Text>{section.body ? <Text style={[styles.body, { color: palette.textSecondary }]}>{section.body}</Text> : null}{section.bullets?.map((bullet) => <View key={bullet} style={styles.bullet}><View style={[styles.dot, { backgroundColor: palette.accent }]} /><Text style={[styles.bulletText, { color: palette.textSecondary }]}>{bullet}</Text></View>)}{section.link ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(section.link!.url)} style={[styles.link, { color: palette.accent }]}>{section.link.label} ↗</Text> : null}</LucidCard>)}
  </LucidScreen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center' }, title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1] }, body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] }, bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.md }, dot: { width: 6, height: 6, borderRadius: LucidRadius.full, marginTop: LucidSpace.sm }, bulletText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] }, link: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] } });
