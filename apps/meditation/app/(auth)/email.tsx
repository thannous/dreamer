import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text, TextField } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';

export default function EmailScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.includes('@') && password.length >= 8;

  return (
    <Screen variant="subtle">
      <View className="flex-1 justify-between px-gutter pb-4 pt-12">
        <View className="gap-6">
          <View className="gap-3">
            <Text variant="h1">{t('auth.email.title')}</Text>
            <Rule className="self-start" />
          </View>

          <View className="gap-4">
            <TextField
              label={t('auth.email.field')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
            />
            <TextField
              label={t('auth.email.password')}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
            />
          </View>
        </View>

        <View className="gap-3 pb-6">
          <Button label={t('auth.email.cta')} disabled={!canSubmit} />
          <Button label={t('auth.email.forgot')} variant="ghost" />
        </View>
      </View>
    </Screen>
  );
}
