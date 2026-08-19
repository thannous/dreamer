import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { LucidCard, LucidIconAction, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

export type LucidInfoSection = { title: string; body?: string; bullets?: readonly string[]; link?: { label: string; url: string } };

export function LucidInfoPage({ eyebrow, title, subtitle, icon, sections }: { eyebrow?: string; title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; sections: readonly LucidInfoSection[] }) {
  const { colors, mode } = useTheme(); const palette = getLucidPalette(colors, mode); const { content } = useLucidTrainer();
  return <LucidScreen eyebrow={eyebrow} title={title} subtitle={subtitle} trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={() => router.back()} />}>
    <LucidCard accent="accent"><View style={[styles.heroIcon, { backgroundColor: palette.accentSoft }]}><Ionicons name={icon} size={33} color={palette.accent} /></View></LucidCard>
    {sections.map((section) => <LucidCard key={section.title}><Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{section.title}</Text>{section.body ? <Text style={[styles.body, { color: palette.textSecondary }]}>{section.body}</Text> : null}{section.bullets?.map((bullet) => <View key={bullet} style={styles.bullet}><View style={[styles.dot, { backgroundColor: palette.accent }]} /><Text style={[styles.bulletText, { color: palette.textSecondary }]}>{bullet}</Text></View>)}{section.link ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(section.link!.url)} style={[styles.link, { color: palette.accent }]}>{section.link.label} ↗</Text> : null}</LucidCard>)}
  </LucidScreen>;
}
const styles = StyleSheet.create({ heroIcon: { width: 68, height: 68, borderRadius: 23, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, lineHeight: 23 }, body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 21 }, bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 }, bulletText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 }, link: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, lineHeight: 19 } });
