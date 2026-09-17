import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';

interface RecordingInputModeSelectProps {
  value: RecordingInputModePreference;
  disabled?: boolean;
  onChange: (value: RecordingInputModePreference) => void | Promise<void>;
}

export function RecordingInputModeSelect({
  value,
  disabled = false,
  onChange,
}: RecordingInputModeSelectProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const options = useMemo(
    () => [
      {
        value: 'text' as const,
        label: t('recording.preference.text'),
        icon: 'pencil' as const,
        testID: TID.Button.InputModeText,
      },
      {
        value: 'voice' as const,
        label: t('recording.preference.voice'),
        icon: 'mic' as const,
        testID: TID.Button.InputModeVoice,
      },
    ],
    [t]
  );

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('recording.preference.label')}
      accessibilityHint={t('recording.onboarding.preference.settings_hint')}
      style={[
        styles.wrap,
        {
          backgroundColor: noctalia.surface.base,
          borderColor: noctalia.surface.border,
          opacity: disabled ? 0.65 : 1,
        },
      ]}
      testID={TID.Button.InputModeSelect}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!isSelected) {
                void onChange(option.value);
              }
            }}
            disabled={disabled}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? noctalia.surface.active : 'transparent',
                borderColor: isSelected ? noctalia.accent.base : 'transparent',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={option.label}
            testID={option.testID}
          >
            <IconSymbol
              name={option.icon}
              size={16}
              color={isSelected ? noctalia.accent.text : noctalia.text.secondary}
            />
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? noctalia.text.primary : noctalia.text.secondary },
              ]}
              testID={TID.Text.RecordingInputMode(option.value)}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 4,
    gap: 4,
    zIndex: 20,
  },
  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  optionText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
