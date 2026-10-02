import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type Exploration360PanelProps = {
  hasSynthesis: boolean;
  canGenerateSynthesis: boolean;
  onSynthesisPress?: () => void;
  onReadSynthesisPress?: () => void;
  synthesisDisabled?: boolean;
  style?: ViewStyle;
};

/** Optional recap of the exchanges so far, without a required three-angle journey. */
export function Exploration360Panel({ hasSynthesis, canGenerateSynthesis, onSynthesisPress,
  onReadSynthesisPress, synthesisDisabled = false, style }: Exploration360PanelProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  if (!hasSynthesis && !canGenerateSynthesis) return null;

  const current = hasSynthesis && !canGenerateSynthesis;
  const action = current ? onReadSynthesisPress : onSynthesisPress;
  const disabled = !current && synthesisDisabled;
  const actionKey = current ? 'dream_categories.recap.read'
    : hasSynthesis ? 'dream_categories.recap.update' : 'dream_categories.exploration360.synthesis.cta';

  return <View style={[styles.panel, style]} testID={TID.Component.Exploration360Panel}>
    <Text accessibilityLiveRegion="polite" testID={current ? 'text.reflection.recapCurrent' : undefined}
      style={[styles.body, { color: tokens.text.secondary }]}>
      {t(current ? 'dream_categories.exploration360.body.done'
        : hasSynthesis ? 'dream_categories.recap.enrich' : 'dream_categories.exploration360.body.ready')}
    </Text>
    {action ? <Pressable onPress={action} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      testID={current ? 'btn.reflection.readRecap' : TID.Button.Exploration360Synthesis}
      style={({ pressed }) => [styles.button, { backgroundColor: current ? tokens.surface.soft : tokens.action.primary },
        (disabled || pressed) && styles.dimmed]}>
      <Text style={[styles.buttonText, { color: current ? tokens.accent.text : tokens.action.primaryText }]}>{t(actionKey)}</Text>
      <IconSymbol name="arrow.right" size={18} color={current ? tokens.accent.text : tokens.action.primaryText} />
    </Pressable> : null}
    {!current ? <Text style={[styles.access, { color: tokens.text.secondary }]}>{t('dream_categories.recap.plus')}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  buttonText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  access: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 17 },
  dimmed: { opacity: 0.65 },
});
