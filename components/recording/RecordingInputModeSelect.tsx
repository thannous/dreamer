import React, { useMemo, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const surfaceColor = noctalia.surface.base;
  const borderColor = noctalia.surface.border;
  const textColor = noctalia.text.primary;
  const mutedColor = noctalia.text.secondary;
  const accentColor = noctalia.accent.base;
  const selectedMetaColor = mode === 'dark' ? noctalia.accent.soft : noctalia.accent.strong;

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
            backgroundColor: surfaceColor,
            borderColor,
            opacity: disabled ? 0.65 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${t('recording.preference.label')}: ${selected.label}`}
        accessibilityHint={t('recording.preference.accessibility')}
        accessibilityState={{ expanded: isOpen, disabled }}
        accessibilityValue={{ text: selected.label }}
        testID={TID.Button.InputModeSelect}
      >
        <View style={[styles.triggerIcon, { backgroundColor: `${accentColor}24` }]}>
          <IconSymbol name={selected.icon} size={18} color={accentColor} />
        </View>
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerLabel, { color: mutedColor }]}>
            {t('recording.preference.label')}
          </Text>
          <Text
            style={[styles.triggerValue, { color: textColor }]}
            testID={TID.Text.RecordingInputMode(value)}
          >
            {selected.label}
          </Text>
        </View>
        <IconSymbol name="slider.horizontal.3" size={18} color={mutedColor} />
      </Pressable>

      {isOpen ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('recording.preference.dismiss_accessibility')}
            onPress={() => setIsOpen(false)}
            style={styles.dismissLayer}
            testID={TID.Button.InputModeDismiss}
          />
          <View
            style={[
              styles.menu,
              {
                backgroundColor: surfaceColor,
                borderColor,
              },
            ]}
          >
            <View style={styles.menuHeader}>
              <IconSymbol name={selected.icon} size={15} color={mutedColor} />
              <Text style={[styles.label, { color: mutedColor }]}>
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
                      backgroundColor: isSelected
                        ? `${accentColor}28`
                        : noctalia.surface.soft,
                      borderColor: isSelected ? accentColor : borderColor,
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
                        backgroundColor: isSelected
                          ? `${accentColor}28`
                          : noctalia.surface.soft,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={option.icon}
                      size={16}
                      color={isSelected ? accentColor : mutedColor}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: textColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionMeta,
                        { color: isSelected ? selectedMetaColor : mutedColor },
                      ]}
                    >
                      {isSelected
                        ? t('recording.preference.selected')
                        : t(`recording.preference.${option.value}_hint`)}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={[styles.checkBadge, { backgroundColor: accentColor }]}>
                      <IconSymbol
                        name="checkmark"
                        size={13}
                        color={noctalia.action.primaryText}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
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
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  triggerIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerCopy: {
    minWidth: 58,
    gap: 1,
  },
  triggerLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  triggerValue: {
    fontSize: 14,
    lineHeight: 17,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  dismissLayer: {
    position: 'absolute',
    top: -1000,
    right: -1000,
    bottom: -1000,
    left: -1000,
    zIndex: 21,
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
  },
  menu: {
    marginTop: 4,
    alignSelf: 'flex-end',
    zIndex: 22,
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
