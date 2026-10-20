import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { DreamShareImage } from '@/components/journal/DreamShareImage';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getDefaultShareCardOptions,
  getShareCardTexts,
  type ShareCardOptions,
  type ShareCardText,
} from '@/lib/journal/shareCard';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

/** The card is drawn at 1080x1350 and shown here at a fifth of its size. */
const PREVIEW_SCALE = 0.2;
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const LABEL_CLASS = 'font-sans-medium text-[12px] uppercase tracking-[1.6px] text-champagne-on';

const TEXT_LABEL_KEYS: Record<ShareCardText, string> = {
  none: 'journal.detail.share_sheet.text_none',
  story: 'journal.detail.share_sheet.text_story',
  quote: 'journal.detail.share_sheet.text_quote',
};

function ShareChoice({
  label,
  selected,
  role,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  role: 'checkbox' | 'radio';
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  // What goes on the card is ticked; the words under the name are one of a set, side by side.
  const isText = role === 'radio';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      className={`min-h-[44px] flex-row items-center justify-center gap-1.5 border ${
        isText ? 'flex-1 rounded-[14px] px-2 py-1.5' : 'rounded-full px-4'
      } ${selected ? 'border-champagne bg-champagne' : 'border-line bg-ink-soft'} ${disabled ? 'opacity-60' : ''}`}
    >
      {selected && !isText ? <IconSymbol name="checkmark" size={14} color={noctalia.action.primaryText} /> : null}
      <Text
        numberOfLines={2}
        className={`text-center font-sans-medium text-[14px] leading-[18px] ${selected ? 'text-on-champagne' : 'text-ivory'}`}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Before a dream is shared, the dreamer chooses what its card shows and sees it as it
 * will leave: the illustration, the title, the date, and the story or the line the dream
 * inspired. « Créé par Noctalia Dream » stays on every card.
 */
export function DreamShareSheet({
  visible,
  onClose,
  onShare,
  dream,
  date,
  painting,
  paintingPending,
  sharing,
}: {
  visible: boolean;
  onClose: () => void;
  onShare: (options: ShareCardOptions) => void;
  dream: DreamAnalysis;
  date: string;
  /** The dream's resolved illustration, or '' when it has none to show. */
  painting: string;
  /** The illustration is still being resolved. */
  paintingPending: boolean;
  sharing: boolean;
}) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ShareCardOptions>(() => getDefaultShareCardOptions(dream));
  // Each opening starts from the card as first offered.
  const [shownOpen, setShownOpen] = useState(visible);
  if (visible !== shownOpen) {
    setShownOpen(visible);
    if (visible) setOptions(getDefaultShareCardOptions(dream));
  }

  const hasPainting = Boolean(painting) || paintingPending;
  const hasTitle = Boolean(dream.title?.trim());
  const texts = getShareCardTexts(dream);
  const card: ShareCardOptions = {
    painting: options.painting && hasPainting,
    title: options.title && hasTitle,
    date: options.date,
    text: texts.includes(options.text) ? options.text : 'none',
  };
  const waitsForPainting = card.painting && paintingPending;
  const toggle = (key: 'painting' | 'title' | 'date') =>
    setOptions((current) => ({ ...current, [key]: !current[key] }));

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('journal.detail.share_modal.title')}
      subtitle={t('journal.detail.share_sheet.subtitle')}
      testID={TID.Sheet.DreamShare}
      // An illustration slow to sign keeps the button waiting, never the dreamer from leaving.
      dismissBehavior={sharing ? 'none' : 'pan'}
      actions={{
        primaryLabel: t('journal.detail.share_sheet.share'),
        primaryIcon: 'square.and.arrow.up',
        onPrimary: () => onShare(card),
        primaryLoading: sharing || waitsForPainting,
        primaryTestID: TID.Button.DreamShareCard,
      }}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('journal.detail.share_sheet.preview')}
        importantForAccessibility="yes"
        className="mb-5 mt-1 self-center overflow-hidden rounded-[18px] border border-line"
        style={{ width: CARD_WIDTH * PREVIEW_SCALE, height: CARD_HEIGHT * PREVIEW_SCALE }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale: PREVIEW_SCALE }], transformOrigin: 'top left' }}
        >
          <DreamShareImage dream={dream} t={t} options={card} date={date} resolvedMedia={{ imageUrl: card.painting ? painting : '' }} />
        </View>
      </View>

      <View className="mb-4 gap-2.5">
        <Text className={LABEL_CLASS}>{t('journal.detail.share_sheet.on_card')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {hasPainting ? (
            <ShareChoice role="checkbox" label={t('journal.detail.share_sheet.painting')} selected={card.painting}
              disabled={sharing} onPress={() => toggle('painting')} />
          ) : null}
          {hasTitle ? (
            <ShareChoice role="checkbox" label={t('journal.detail.share_sheet.name')} selected={card.title}
              disabled={sharing} onPress={() => toggle('title')} />
          ) : null}
          <ShareChoice role="checkbox" label={t('journal.detail.share_sheet.date')} selected={card.date}
            disabled={sharing} onPress={() => toggle('date')} />
        </View>
      </View>

      {texts.length > 1 ? (
        <View className="mb-2 gap-2.5">
          <Text className={LABEL_CLASS}>{t('journal.detail.share_sheet.words')}</Text>
          <View accessibilityRole="radiogroup" className="flex-row gap-2">
            {texts.map((text) => (
              <ShareChoice key={text} role="radio" label={t(TEXT_LABEL_KEYS[text])} selected={card.text === text}
                disabled={sharing} onPress={() => setOptions((current) => ({ ...current, text }))} />
            ))}
          </View>
        </View>
      ) : null}
    </StandardBottomSheet>
  );
}
