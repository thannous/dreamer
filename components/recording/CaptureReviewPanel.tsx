import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CaptureOriginal } from './CaptureOriginal';
import { RecordingTextInput } from './RecordingTextInput';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

export function CaptureReviewPanel({ text, source, disabled, onChange }: {
  text: string; source: string; disabled: boolean; onChange: (text: string) => void;
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
  </View>;
}
const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 30, marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
});
