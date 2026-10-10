import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { BackLink, Button, Card, Rule, Text } from '@/components/ui';
import { WorldPage } from '@/components/worlds/WorldPage';
import { isBreathingPatternId } from '@/content/breathing';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import type { TranslationKey } from '@/lib/i18n';
import { resumableSession } from '@/lib/library';

/** Recorded local days and durations; never infer an hour or a world. */
export default function HistoryScreen() {
  const router = useRouter();
  const { language, t } = useTranslation();
  const { practiceLog, progress } = useLibrary();
  const resume = useMemo(() => resumableSession(progress), [progress]);
  const entries = useMemo(() => practiceLog.map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.index - a.index), [practiceLog]);

  return (
    <WorldPage>
      <BackLink label={t('common.back')} className="px-gutter pb-2 pt-2" />
      <FlatList
        testID="screen.history"
        data={entries}
        keyExtractor={(entry) => String(entry.index)}
        contentContainerClassName="gap-4 px-gutter pb-8 pt-4"
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <Text variant="h1">{t('history.title')}</Text>
            <Rule className="self-start" />
            <Text variant="bodySm">{t('history.subtitle')}</Text>
            <Text variant="caption" tone="muted">{t('history.counted')}</Text>
            {resume ? (
              <Button variant="secondary" testID="btn.history.resume"
                label={`${t('session.resume')} · ${t(`session.${resume.session.id}.title` as TranslationKey)}`}
                onPress={() => router.push(`/player/${resume.session.id}`)} />
            ) : null}
          </View>
        }
        ListEmptyComponent={<Card testID="history.empty"><Text variant="bodySm">{t('history.empty')}</Text></Card>}
        renderItem={({ item }) => {
          const session = item.sessionId ? SESSION_BY_ID[item.sessionId] : undefined;
          const pattern = !session && item.patternId && isBreathingPatternId(item.patternId) ? item.patternId : null;
          const title = session ? t(`session.${session.id}.title` as TranslationKey)
            : pattern ? t(`breathe.pattern.${pattern}.name` as TranslationKey) : t('history.practice');
          const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.dateISO);
          const date = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
            .toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) : item.dateISO;
          const seconds = Math.max(0, Math.round(item.seconds));
          const duration = t('history.duration', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
          const open = () => {
            if (session) router.push(`/session/${session.id}`);
            else if (pattern) router.push(`/breathe/${pattern}`);
          };
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${date}. ${duration}`}
              accessibilityHint={session || pattern ? t('history.open') : undefined}
              accessibilityState={{ disabled: !session && !pattern }} disabled={!session && !pattern}
              onPress={open} testID={`history.entry.${item.index}`} className="min-h-12 active:opacity-70">
              <Card>
                <View className="gap-2">
                  <Text variant="caption" tone="accent">{date}</Text>
                  <Text variant="h3">{title}</Text>
                  <Text variant="bodySm">{duration}</Text>
                  {session || pattern ? <Text variant="caption" tone="accent">{t('history.open')}</Text> : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </WorldPage>
  );
}
