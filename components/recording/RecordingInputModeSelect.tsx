import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

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
  const selected = options.find((option) => option.value === value) ?? options[0];

  const handleSelect = (nextValue: RecordingInputModePreference) => {
    setIsOpen(false);
    if (nextValue !== value) {
      void onChange(nextValue);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        disabled={disabled}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.divider,
            opacity: disabled ? 0.65 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('recording.preference.accessibility')}
        accessibilityState={{ expanded: isOpen, disabled }}
        testID={TID.Button.InputModeSelect}
      >
        <IconSymbol name="gear" size={20} color={colors.textPrimary} />
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.divider,
            },
          ]}
        >
          <View style={styles.menuHeader}>
            <IconSymbol name={selected.icon} size={15} color={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('recording.preference.view_title')}
            </Text>
          </View>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected ? `${colors.accent}24` : `${colors.textPrimary}08`,
                    borderColor: isSelected ? colors.accent : `${colors.divider}AA`,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={option.testID}
              >
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor: isSelected ? `${colors.accent}28` : `${colors.textPrimary}10`,
                    },
                  ]}
                >
                  <IconSymbol
                    name={option.icon}
                    size={16}
                    color={isSelected ? colors.accent : colors.textSecondary}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? colors.accent : colors.textPrimary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionMeta,
                      { color: isSelected ? colors.accent : colors.textSecondary },
                    ]}
                  >
                    {isSelected
                      ? t('recording.preference.selected')
                      : t(`recording.preference.${option.value}_hint`)}
                  </Text>
                </View>
                {isSelected ? (
                  <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                    <IconSymbol name="checkmark" size={13} color={colors.backgroundSecondary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    alignItems: 'flex-end',
    zIndex: 20,
  },
  trigger: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuHeader: {
    minHeight: 32,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  menu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 286,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 8,
    gap: 8,
  },
  option: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 9,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  optionMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
