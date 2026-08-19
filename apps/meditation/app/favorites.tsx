import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SessionCard } from '@/components/session/SessionCard';
import { BackLink, Button, Rule, Text } from '@/components/ui';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';

export default function FavoritesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { favorites } = useLibrary();

  // Saved ids are filtered through the catalogue: an id left over from a
  // removed session must not render an empty row.
  const sessions = useMemo(
    () => favorites.map((id) => SESSION_BY_ID[id]).filter(Boolean),
    [favorites]
  );

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pb-2 pt-2" />

      <ScrollView
        contentContainerClassName="px-gutter pb-10 pt-4 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('favorites.title')}</Text>
          <Rule className="self-start" />
        </View>

        {sessions.length === 0 ? (
          <View className="gap-3 py-10">
            <Text variant="h3" className="text-center">
              {t('favorites.empty.title')}
            </Text>
            <Text variant="bodySm" className="text-center">
              {t('favorites.empty.subtitle')}
            </Text>
            <Button
              label={t('favorites.empty.cta')}
              variant="secondary"
              className="mt-4"
              onPress={() => router.push('/search')}
            />
          </View>
        ) : (
          sessions.map((session) => <SessionCard key={session.id} session={session} />)
        )}
      </ScrollView>
    </Screen>
  );
}
