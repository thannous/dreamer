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
  variant?: 'inline' | 'reflection';
};

/** Optional recap of the exchanges so far, without a required three-angle journey. */
export function Exploration360Panel({ hasSynthesis, canGenerateSynthesis, onSynthesisPress,
  onReadSynthesisPress, synthesisDisabled = false, style, variant = 'inline' }: Exploration360PanelProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  if (!hasSynthesis && !canGenerateSynthesis) return null;

  const reflection = variant === 'reflection';
  const current = hasSynthesis && !canGenerateSynthesis;
  const action = current ? onReadSynthesisPress : onSynthesisPress;
  const disabled = !current && synthesisDisabled;
  const actionKey = current ? 'dream_categories.recap.read'
    : hasSynthesis ? 'dream_categories.recap.update' : 'dream_categories.exploration360.synthesis.cta';

  return <View style={[styles.panel, reflection && styles.reflectionPanel, reflection && { borderColor: tokens.surface.border }, style]} testID={TID.Component.Exploration360Panel}>
    <Text accessibilityLiveRegion="polite" testID={current ? 'text.reflection.recapCurrent' : undefined}
      style={[styles.body, { color: reflection ? tokens.text.primary : tokens.text.secondary }]}>
      {t(current ? 'dream_categories.exploration360.body.done'
        : hasSynthesis ? 'dream_categories.recap.enrich' : reflection ? 'dream_categories.recap.context' : 'dream_categories.exploration360.body.ready')}
    </Text>
    {action ? <Pressable onPress={action} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      testID={current ? 'btn.reflection.readRecap' : TID.Button.Exploration360Synthesis}
      style={({ pressed }) => [styles.button, reflection && styles.reflectionButton, { backgroundColor: current ? tokens.surface.soft : tokens.action.primary },
        (disabled || pressed) && styles.dimmed]}>
      <Text style={[styles.buttonText, reflection && styles.reflectionButtonText, { color: current ? tokens.accent.text : tokens.action.primaryText }]}>{t(actionKey)}</Text>
      <IconSymbol name="arrow.right" size={reflection ? 22 : 18} color={current ? tokens.accent.text : tokens.action.primaryText} />
    </Pressable> : null}
    {!current ? <Text style={[styles.access, reflection && styles.reflectionAccess, { color: tokens.text.secondary }]}>{t('dream_categories.recap.plus')}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  buttonText: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  access: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 17 },
  reflectionPanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  reflectionButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  reflectionButtonText: { flex: 1, textAlign: 'center', fontFamily: Fonts.fraunces.semiBold, fontSize: 20, lineHeight: 26 },
  reflectionAccess: { textAlign: 'center' },
  dimmed: { opacity: 0.65 },
});
