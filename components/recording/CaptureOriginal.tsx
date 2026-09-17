import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

export function CaptureOriginal({ source }: { source: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const theme = getNoctaliaDesignTokens(colors, mode);
  return <View style={styles.original}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.action}>
      <Text style={{ color: theme.accent.text }}>{t('recording.review.original')}</Text>
    </Pressable>
    {expanded ? <Text selectable style={[styles.body, { color: theme.text.secondary }]}>{source}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingVertical: 12 },
  original: { marginTop: 8 },
});
