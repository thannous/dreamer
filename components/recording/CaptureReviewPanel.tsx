import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CaptureOriginal } from './CaptureOriginal';
import { RecordingTextInput } from './RecordingTextInput';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

export function CaptureReviewPanel({ text, source, disabled, onChange, onExit }: {
  text: string; source: string; disabled: boolean; onChange: (text: string) => void; onExit: () => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const theme = getNoctaliaDesignTokens(colors, mode);
  return <View>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>{t('recording.review.title')}</Text>
      <Pressable onPress={onExit} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={t('recording.review.exit')} style={styles.close} testID="capture-review-exit">
        <IconSymbol name="xmark" size={23} color={theme.text.primary} />
      </Pressable>
    </View>
    <Text style={[styles.body, { color: theme.text.secondary }]}>{t('recording.review.hint')}</Text>
    <RecordingTextInput value={text} onChange={onChange} disabled={disabled} lengthWarning=""
      instructionText="" voiceSupported={false} autoFocus={false} onSwitchToVoice={() => {}}
      inputTestID="capture-review-text" inputAccessibilityLabel={t('recording.review.title')} />
    <CaptureOriginal source={source} />
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  close: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, lineHeight: 30 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
});
