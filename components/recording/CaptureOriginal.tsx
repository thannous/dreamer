import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

export function CaptureOriginal({ source }: { source: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const theme = getNoctaliaDesignTokens(colors, mode);
  return <View style={styles.original}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[styles.action, { borderColor: theme.surface.border }]}>
      <View style={styles.label}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{t('recording.review.original')}</Text>
        <Text style={[styles.hint, { color: theme.text.secondary }]}>{t('recording.review.original_hint')}</Text>
      </View>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={20} color={theme.text.primary} />
      </View>
    </Pressable>
    {expanded ? <Text selectable style={[styles.body, { color: theme.text.secondary }]}>{source}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
  original: { marginTop: 8 },
  label: { flex: 1, gap: 4 },
  title: { fontSize: 16, lineHeight: 23 },
  hint: { fontSize: 13, lineHeight: 19 },
});
