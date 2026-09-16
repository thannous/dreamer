import Feather from '@expo/vector-icons/Feather';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

const LIGHT_NOTEBOOK = require('@/assets/images/journal-first-page-light.webp');
const DARK_NOTEBOOK = require('@/assets/images/journal-first-page-dark.webp');

type JournalFirstPageProps = {
  bottomInset: number;
  onStartDream: () => void;
  onSettings: () => void;
};

/** Only shown after a complete, successful read confirms an unfiltered empty journal. */
export function JournalFirstPage({ bottomInset, onStartDream, onSettings }: JournalFirstPageProps) {
  const { colors, mode } = useTheme();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);

  return (
    <View className="flex-1 bg-ink" style={{ marginBottom: bottomInset }}>
      <NoctaliaScreenHeader
        titleKey="nav.journal"
        actions={[{
          icon: 'gear',
          onPress: onSettings,
          accessibilityLabel: t('nav.settings'),
          testID: TID.Button.HeaderJournalSettings,
        }]}
      />
      <ScrollView
        testID="journal-first-page"
        className="flex-1 bg-ink"
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={{ minHeight: contentHeight, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[560px] flex-1 self-center px-6">
          <View className="flex-1 gap-4 pt-8">
            <Feather name="book-open" size={25} color={tokens.text.secondary} accessible={false} />
            <Text accessibilityRole="header" className="font-display text-[28px] leading-[35px] text-ivory">
              {t('journal.first_page.title')}
            </Text>
            <Image
              testID="journal-first-page-art"
              source={mode === 'dark' ? DARK_NOTEBOOK : LIGHT_NOTEBOOK}
              resizeMode="contain"
              accessible={false}
              importantForAccessibility="no"
              className="w-full self-center"
              style={{ aspectRatio: 1.5, maxHeight: fontScale > 1.2 ? 180 : 240 }}
            />
            <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
              {t('journal.first_page.body')}
            </Text>
            <View className="min-h-3 flex-1" />
            <Pressable
              testID={TID.Button.EmptyStartRememberedDream}
              accessibilityRole="button"
              accessibilityLabel={t('journal.first_page.cta')}
              onPress={onStartDream}
              className="min-h-14 flex-row items-center justify-between gap-3 rounded-[18px] bg-champagne px-5 py-4 active:opacity-80"
            >
              <Text className="min-w-0 flex-1 font-sans-medium text-[16px] leading-[22px] text-on-champagne">
                {t('journal.first_page.cta')}
              </Text>
              <Feather name="arrow-right" size={22} color={tokens.action.primaryText} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
