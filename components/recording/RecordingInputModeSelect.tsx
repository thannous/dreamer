import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecordingSpotlightRect } from '@/components/recording/RecordingOnboardingSpotlightOverlay';
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
  highlighted?: boolean;
  highlightBadge?: number;
  highlightMeasureKey?: number;
  onHighlightLayout?: (rect: RecordingSpotlightRect) => void;
  onOpenChange?: (open: boolean) => void;
  onOptionSelected?: (value: RecordingInputModePreference) => void;
  onChange: (value: RecordingInputModePreference) => void | Promise<void>;
}

export function RecordingInputModeSelect({
  value,
  disabled = false,
  highlighted = false,
  highlightBadge = 1,
  highlightMeasureKey = 0,
  onHighlightLayout,
  onOpenChange,
  onOptionSelected,
  onChange,
}: RecordingInputModeSelectProps) {
  const { colors, mode, shadows } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const highlightTargetRef = useRef<View | null>(null);
  const menuRef = useRef<View | null>(null);
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
        hint: t('recording.preference.text_hint'),
        icon: 'pencil' as const,
        testID: TID.Button.InputModeText,
      },
      {
        value: 'voice' as const,
        label: t('recording.preference.voice'),
        hint: t('recording.preference.voice_hint'),
        icon: 'mic' as const,
        testID: TID.Button.InputModeVoice,
      },
    ],
    [t]
  );
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!highlighted || !onHighlightLayout) {
      return;
    }

    const measureTrigger = () => {
      const targetRef = isOpen ? menuRef : highlightTargetRef;
      targetRef.current?.measureInWindow((x, y, width, height) => {
        onHighlightLayout({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureTrigger);
    const timeout = setTimeout(measureTrigger, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [highlightMeasureKey, highlighted, isOpen, onHighlightLayout]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const handleSelect = (nextValue: RecordingInputModePreference) => {
    handleOpenChange(false);
    onOptionSelected?.(nextValue);
    if (nextValue !== value) {
      void onChange(nextValue);
    }
  };

  return (
    <View style={styles.wrap}>
      {isOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('recording.preference.dismiss_accessibility')}
          onPress={() => handleOpenChange(false)}
          style={styles.dismissLayer}
          testID={TID.Button.InputModeDismiss}
        />
      ) : null}

      <View ref={highlightTargetRef} collapsable={false} style={styles.controlsColumn}>
        <View style={styles.triggerSpotlight}>
          {highlighted ? (
            <>
              <View
                pointerEvents="none"
                style={[
                  styles.highlightHalo,
                  {
                    backgroundColor: `${accentColor}24`,
                    borderColor: accentColor,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[styles.highlightBadge, { backgroundColor: accentColor }]}
              >
                <Text style={[styles.highlightBadgeText, { color: noctalia.action.primaryText }]}>
                  {highlightBadge}
                </Text>
              </View>
            </>
          ) : null}
          <Pressable
            onPress={() => handleOpenChange(!isOpen)}
            disabled={disabled}
            style={[
              styles.trigger,
              {
                backgroundColor: highlighted ? accentColor : surfaceColor,
                borderColor: highlighted ? noctalia.accent.soft : borderColor,
                borderWidth: highlighted ? 2 : 1,
                opacity: disabled ? 0.65 : 1,
              },
              highlighted && shadows.xl,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${t('recording.preference.label')}: ${selected.label}`}
            accessibilityHint={t('recording.preference.accessibility')}
            accessibilityState={{ expanded: isOpen, disabled }}
            accessibilityValue={{ text: selected.label }}
            testID={TID.Button.InputModeSelect}
          >
            <IconSymbol
              name="line.3.horizontal"
              size={22}
              color={highlighted ? noctalia.action.primaryText : mutedColor}
            />
          </Pressable>
        </View>

        {isOpen ? (
          <View
            ref={menuRef}
            collapsable={false}
            style={[
              styles.menu,
              {
                backgroundColor: surfaceColor,
                borderColor: highlighted ? accentColor : borderColor,
                borderWidth: highlighted ? 2 : 1,
              },
              highlighted && shadows.xl,
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
                      testID={
                        isSelected ? TID.Text.RecordingInputMode(option.value) : undefined
                      }
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionMeta,
                        { color: isSelected ? selectedMetaColor : mutedColor },
                      ]}
                    >
                      {option.hint}
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
        ) : null}
      </View>
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
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsColumn: {
    alignItems: 'flex-end',
    zIndex: 22,
  },
  triggerSpotlight: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 24,
  },
  highlightHalo: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
  },
  highlightBadge: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 26,
  },
  highlightBadgeText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    lineHeight: 16,
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
    position: 'absolute',
    top: 48,
    right: 0,
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
