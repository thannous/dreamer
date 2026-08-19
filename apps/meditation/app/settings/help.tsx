import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BackLink, Button, IconSymbol, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type { TranslationKey } from '@/lib/i18n';

const QUESTIONS = [1, 2, 3, 4, 5] as const;
const CONTACT = 'mailto:bonjour@noctalia.app';

function FaqItem({ index }: { index: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((value) => !value)}
      className="border-b border-hairline py-4 active:opacity-70">
      <View className="flex-row items-start justify-between gap-4">
        <Text variant="body" className="flex-1">
          {t(`help.q${index}` as TranslationKey)}
        </Text>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          color={colors.accentText}
          size={18}
        />
      </View>
      {open ? (
        <Text variant="bodySm" className="mt-3">
          {t(`help.a${index}` as TranslationKey)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        contentContainerClassName="px-gutter pb-16 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('help.title')}</Text>
          <Rule className="self-start" />
        </View>

        <View>
          {QUESTIONS.map((index) => (
            <FaqItem key={index} index={index} />
          ))}
        </View>

        <Button
          label={t('help.contact')}
          variant="secondary"
          onPress={() => Linking.openURL(CONTACT).catch(() => {})}
        />
      </ScrollView>
    </Screen>
  );
}
