import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordingTextInput } from './RecordingTextInput';
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

export function CaptureReviewPanel({ text, source, disabled, onChange, onBack }: {
  text: string; source: string; disabled: boolean; onChange: (text: string) => void; onBack: () => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const theme = getNoctaliaDesignTokens(colors, mode);
  return <View>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>{t('recording.review.title')}</Text>
    <Text style={[styles.body, { color: theme.text.secondary }]}>{t('recording.review.hint')}</Text>
    <RecordingTextInput value={text} onChange={onChange} disabled={disabled} lengthWarning=""
      instructionText="" voiceSupported={false} autoFocus={false} onSwitchToVoice={() => {}}
      inputTestID="capture-review-text" inputAccessibilityLabel={t('recording.review.title')} />
    <CaptureOriginal source={source} />
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onBack} style={styles.action}>
      <Text style={{ color: theme.accent.text }}>{t('recording.review.back')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 30, marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingVertical: 12 },
  original: { marginTop: 8 },
});
