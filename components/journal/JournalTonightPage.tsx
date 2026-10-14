import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalFolio } from '@/components/journal/JournalFolio';
import { JournalRunningHead, RUNNING_HEAD_GAP } from '@/components/journal/JournalRunningHead';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useReminderOptIn } from '@/hooks/useReminderOptIn';
import { useTranslation } from '@/hooks/useTranslation';

const PEN_ART = require('@/assets/images/dream-seal-pen.webp');
/** The saved moment's astrolabe, sketched where the next dream's seal will be struck. */
const ORBIT = 240;
const CENTER = ORBIT / 2;
/** Before dawn, the night in progress is still tonight's. */
const DAWN_HOUR = 5;
const RULED_LINES = 5;

/**
 * The page after the last dream: the next page of the journal, waiting for tonight's dream.
 * It keeps a dream page's layout (the running head with the next page's number, the place
 * of the seal sketched in dotted ink, the night where a name would stand) and says only that
 * it is waiting. Touching its lines or the pen resting on them opens the capture; while the
 * morning reminder is off it offers to set it. It is the journal's last page: turning back
 * returns to the last dream. Drawn without its actions while it is only being turned to.
 */
export function JournalTonightPage({ folio, interactive }: {
  /** This page's number: one past the last dream's. */
  folio?: number;
  interactive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { formatDate } = useLocaleFormatting();
  const reminder = useReminderOptIn('journal_detail');
  const ink = noctalia.accent.text;

  const night = useMemo(() => {
    const date = new Date();
    if (date.getHours() < DAWN_HOUR) date.setDate(date.getDate() - 1);
    return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
  }, [formatDate]);
  const write = () => router.push('/recording');

  return (
    <View className="flex-1 overflow-hidden bg-ink" pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={!interactive} importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      testID="journal.tonight">
      <JournalPaper />
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={{ marginBottom: RUNNING_HEAD_GAP }}>
          <JournalRunningHead onBack={interactive ? () => router.replace('/(tabs)/journal') : undefined}
            backTestID="journal.tonight.back" />
        </View>
        {/* Where the next dream's seal will be struck, sketched in dotted ink. */}
        <View className="items-center" accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width={ORBIT} height={ORBIT}>
            <Circle cx={CENTER} cy={CENTER} r={73} fill="none" stroke={ink} strokeOpacity={0.4}
              strokeWidth={1.1} strokeDasharray="2 5" strokeLinecap="round" />
            <Circle cx={CENTER} cy={CENTER} r={94} fill="none" stroke={ink} strokeOpacity={0.22}
              strokeWidth={0.75} strokeDasharray="1 6" strokeLinecap="round" />
          </Svg>
        </View>
        <View className="px-6" style={{ marginTop: 54 }}>
          <Text accessibilityRole="header" className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
            {t('journal.tonight.title', { date: night })}
          </Text>
          <Text style={{ fontFamily: Fonts.lora.regularItalic, fontSize: 17, lineHeight: 28, color: ink }}>
            {t('journal.tonight.waiting')}
          </Text>
          {/* The lines waiting to be written, with the pen resting across them. */}
          <Pressable onPress={write} accessible={false} className="mt-4">
            {Array.from({ length: RULED_LINES }, (_, index) => (
              <View key={index} style={{ height: 30, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ink, opacity: 0.35 }} />
            ))}
            <Image source={PEN_ART} resizeMode="contain" accessible={false}
              style={{ position: 'absolute', right: 6, top: 18, width: 108, height: 108, transform: [{ rotate: '18deg' }] }} />
          </Pressable>
          <PressableScale onPress={write} accessibilityRole="button" accessibilityLabel={t('journal.tonight.write')}
            testID="journal.tonight.write" className="mt-6 min-h-11 flex-row items-center gap-2 self-start">
            <IconSymbol name="pencil" size={18} color={ink} />
            <Text className="font-sans-medium text-[15px] text-champagne-on">{t('journal.tonight.write')}</Text>
          </PressableScale>
          {interactive && reminder.visible ? (
            reminder.enabled ? (
              <Text className="mt-2 font-sans text-[13px] leading-5 text-ivory-muted">
                {t('reminders.opt_in.enabled_body', { time: reminder.selectedTime })}
              </Text>
            ) : (
              <PressableScale onPress={() => void reminder.enable()} disabled={reminder.busy} accessibilityRole="button"
                accessibilityLabel={t('journal.tonight.remind')} testID="journal.tonight.remind"
                className="mt-1 min-h-11 flex-row items-center gap-2 self-start">
                <IconSymbol name="bell" size={16} color={noctalia.text.secondary} />
                <Text className="font-sans-medium text-[13px] text-ivory-muted">{t('journal.tonight.remind')}</Text>
              </PressableScale>
            )
          ) : null}
        </View>
      </View>
      <View pointerEvents="none" className="absolute left-0 right-0" style={{ bottom: insets.bottom + 12 }}>
        <JournalFolio folio={folio} />
      </View>
      <JournalPageEdges />
    </View>
  );
}
