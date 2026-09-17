import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { CaptureEditableDraft } from '@/lib/captureEditableDraft';

export function CaptureDraftEditor({ draft, disabled, onChange, onClose }: {
  draft: CaptureEditableDraft;
  disabled: boolean;
  onChange: (index: number, text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const theme = getNoctaliaDesignTokens(colors, mode);
  return <View testID="capture-draft-editor">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>{t('recording.adjust.title')}</Text>
      <Pressable onPress={onClose} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={t('recording.adjust.close')} style={styles.close} testID="capture-adjust-close">
        <IconSymbol name="xmark" size={23} color={theme.text.primary} />
      </Pressable>
    </View>
    <Text style={[styles.hint, { color: theme.text.secondary }]}>{t('recording.adjust.hint')}</Text>
    {draft.sections.map((section, index) => {
      const label = section.question ?? t('recording.conversation.your_story');
      const placeholder = t(index === 0 ? 'recording.placeholder' : 'recording.adjust.answer_placeholder');
      return <View key={index} style={[styles.section, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.surface.border }]}>
        <Text style={[styles.question, { color: theme.text.secondary }]}>{label}</Text>
        <View style={styles.editor}>
          <Text pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={[styles.input, styles.measurement]}>{(section.text || placeholder) + '\u200b'}</Text>
          <TextInput multiline scrollEnabled={false} textAlignVertical="top" editable={!disabled} autoFocus={false}
            value={section.text} onChangeText={text => onChange(index, text)} placeholder={placeholder}
            placeholderTextColor={theme.text.secondary} selectionColor={theme.accent.base} underlineColorAndroid="transparent"
            accessibilityLabel={index === 0 ? label : `${t('recording.adjust.answer_label')} ${label}`}
            style={[styles.input, styles.overlay, { color: theme.text.primary }]}
            testID={`capture-adjust-section-${index}`} />
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { flex: 1, fontFamily: Fonts.spaceGrotesk.medium, fontSize: 23, lineHeight: 30 },
  close: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  section: { paddingVertical: 22, gap: 6 },
  question: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 23 },
  editor: { position: 'relative' },
  input: { fontFamily: Fonts.lora.regular, fontSize: 21, lineHeight: 32, paddingHorizontal: 0, paddingVertical: 6, minHeight: 48, borderWidth: 0, includeFontPadding: false },
  measurement: { opacity: 0 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
