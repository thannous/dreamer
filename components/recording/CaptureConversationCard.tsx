import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';

type Props = {
  text: string;
  disabled: boolean;
  pending: boolean;
  saved: boolean;
  onChange: (text: string) => void;
  onSave: () => void | Promise<void>;
  onExit: () => void;
  onOpen: () => void;
};

export function CaptureConversationCard(props: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const saveDisabled = props.disabled || props.pending || !props.text.trim() || editing;
  return <View style={[styles.card, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]} testID="capture-review-card">
    <View style={styles.header}>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, { color: tokens.text.primary }]}
        testID="capture-review-title">
        {t('recording.chat.ready')}
      </Text>
      {!props.saved ? <Pressable accessibilityRole="button" accessibilityLabel={t('recording.review.exit')} onPress={props.onExit}
        disabled={props.disabled} style={styles.close} testID="capture-review-exit">
        <IconSymbol name="xmark" size={18} color={tokens.text.secondary} />
      </Pressable> : <IconSymbol name="checkmark.circle.fill" size={22} color={tokens.text.primary} />}
    </View>
    {editing && !props.saved ? <TextInput
      testID="capture-review-text" accessibilityLabel={t('recording.review.title')}
      value={props.text} onChangeText={props.onChange} multiline autoFocus editable={!props.disabled}
      style={[styles.editor, { color: tokens.text.primary, borderColor: tokens.surface.border }]}
    /> : <Text selectable style={[styles.narrative, { color: tokens.text.primary }]} testID="capture-review-narrative">{props.text}</Text>}
    {!props.saved ? <>
      <Pressable onPress={() => { if (editing) Keyboard.dismiss(); setEditing(!editing); }} disabled={props.disabled}
        accessibilityRole="button" accessibilityLabel={t(editing ? 'common.done' : 'recording.chat.edit')}
        style={styles.edit} testID={editing ? 'capture-review-edit-done' : 'capture-review-edit'}>
        <IconSymbol name={editing ? 'checkmark' : 'pencil'} size={20} color={tokens.text.primary} />
        <Text style={[styles.editText, { color: tokens.text.primary }]}>{t(editing ? 'common.done' : 'recording.chat.edit')}</Text>
      </Pressable>
      {props.pending ? <Text style={[styles.hint, { color: tokens.text.secondary }]}>{t('recording.chat.pending_hint')}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('recording.button.save_dream')}
        accessibilityState={{ disabled: saveDisabled, busy: props.disabled }} disabled={saveDisabled}
        onPress={() => { void props.onSave(); }} testID={TID.Button.SaveDream}
        style={[styles.primary, { backgroundColor: tokens.action.primary, opacity: saveDisabled ? 0.45 : 1 }]}>
        <Text style={[styles.actionText, { color: tokens.action.primaryText }]}>{t('recording.button.save_dream')}</Text>
        {props.disabled ? <ActivityIndicator color={tokens.action.primaryText} /> : <IconSymbol name="arrow.right" size={22} color={tokens.action.primaryText} />}
      </Pressable>
    </> : <>
      <Pressable onPress={props.onOpen} disabled={props.disabled} accessibilityRole="button" testID="capture-review-open" style={styles.edit}>
        <IconSymbol name="book.fill" size={20} color={tokens.text.primary} />
        <Text style={[styles.editText, { color: tokens.text.primary }]}>{t('recording.chat.open')}</Text>
      </Pressable>
      <View style={[styles.primary, { backgroundColor: tokens.action.primary }]} testID="capture-review-confirmed">
        <Text accessibilityLiveRegion="polite" style={[styles.actionText, { color: tokens.action.primaryText }]} testID="capture-review-saved">{t('recording.chat.saved')}</Text>
        <IconSymbol name="checkmark" size={22} color={tokens.action.primaryText} />
      </View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: Fonts.spaceGrotesk.medium, fontSize: 18, lineHeight: 25 },
  close: { minWidth: 44, minHeight: 44, margin: -10, alignItems: 'center', justifyContent: 'center' },
  narrative: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24 },
  editor: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24, minHeight: 120, maxHeight: 260, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  edit: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  editText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20 },
  hint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
  primary: { minHeight: 52, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionText: { flexShrink: 1, fontFamily: Fonts.spaceGrotesk.medium, fontSize: 16, lineHeight: 23 },
});
