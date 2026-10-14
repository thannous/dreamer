import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

/** The running head's line, and the white space it leaves before the page's text. */
export const RUNNING_HEAD_HEIGHT = 44;
export const RUNNING_HEAD_GAP = 20;

/**
 * The line printed at the top of a journal page, as in a book: the journal's name on the
 * inner side, the way back to it, and the page's number on the outer side, with the page's
 * one way to edit it beside the number. It belongs to the page and scrolls away with it.
 * Without `onBack` or `onEdit` it is only printed, as on a page being turned to. Printed
 * over a plate (`overArt`), its words keep a soft halo of the page's ground.
 */
export function JournalRunningHead({ folio, onBack, testID, backTestID, edit, onEdit, editDisabled = false, overArt = false }: {
  /** This dream's place in the journal, counted from the first dream written. */
  folio?: number;
  onBack?: () => void;
  testID?: string;
  backTestID?: string;
  /** The page can be edited: its one edit control, pressable when `onEdit` is given. */
  edit?: boolean;
  onEdit?: () => void;
  editDisabled?: boolean;
  overArt?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const halo = useMemo(() => overArt
    ? { textShadowColor: getNoctaliaPalette(mode).illustration.scrim, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 }
    : undefined, [mode, overArt]);

  const title = (
    <>
      <IconSymbol name="chevron.left" size={13} color={noctalia.text.secondary} />
      <Text allowFontScaling={false} style={halo} className="font-sans-medium text-[12px] uppercase tracking-[2px] text-ivory-muted">
        {t('nav.journal')}
      </Text>
    </>
  );

  return (
    <View testID={testID} className="flex-row items-center justify-between px-3" style={{ height: RUNNING_HEAD_HEIGHT }}>
      {onBack ? (
        <PressableScale onPress={onBack} testID={backTestID} accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="min-h-11 flex-row items-center gap-2 px-3">
          {title}
        </PressableScale>
      ) : (
        <View className="min-h-11 flex-row items-center gap-2 px-3">{title}</View>
      )}
      <View className="flex-row items-center">
        {edit ? (() => {
          const label = (
            <>
              <IconSymbol name="pencil" size={14} color={noctalia.accent.text} />
              <Text allowFontScaling={false} style={halo} className="font-sans-medium text-[13px] text-champagne-on">
                {t('journal.detail.edit_page')}
              </Text>
            </>
          );
          return onEdit ? (
            <PressableScale onPress={onEdit} disabled={editDisabled} testID={TID.Button.EditDream}
              accessibilityRole="button" accessibilityLabel={t('journal.detail.edit_page_accessibility')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className={`min-h-11 flex-row items-center gap-1.5 px-2 ${editDisabled ? 'opacity-60' : ''}`}>
              {label}
            </PressableScale>
          ) : (
            <View className="min-h-11 flex-row items-center gap-1.5 px-2">{label}</View>
          );
        })() : null}
        {folio ? (
          <Text allowFontScaling={false} accessible={false} className="px-3 text-[13px] text-ivory-muted"
            style={[{ fontFamily: Fonts.lora.regular }, halo]}>
            {folio}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
