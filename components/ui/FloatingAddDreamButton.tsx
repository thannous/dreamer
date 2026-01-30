import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DreamIcon } from '@/components/icons/DreamIcons';
import { ThemeLayout } from '@/constants/journalTheme';
import { LAYOUT_MAX_WIDTH } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { MotiView } from '@/lib/moti';

type FloatingAddDreamButtonProps = {
  onPress: () => void;
  label: string;
  accessibilityLabel: string;
  bottomOffset: number;
  isDesktopLayout?: boolean;
  testID?: string;
  animationDelay?: number;
};

export function FloatingAddDreamButton({
  onPress,
  label,
  accessibilityLabel,
  bottomOffset,
  isDesktopLayout = false,
  testID,
  animationDelay = 400,
}: FloatingAddDreamButtonProps) {
  const { colors } = useTheme();
  const contentColor = colors.textOnAccentSurface;

  return (
    <View
      style={[
        styles.container,
        isDesktopLayout && styles.containerDesktop,
        { bottom: bottomOffset },
      ]}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: 'spring',
          damping: 14,
          stiffness: 120,
          delay: animationDelay,
        }}
      >
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent },
            pressed && styles.buttonPressed,
          ]}
          onPress={onPress}
          accessibilityRole="button"
          testID={testID}
          accessibilityLabel={accessibilityLabel}
        > 
          <DreamIcon size={22} color={contentColor} />
          <Text style={[styles.buttonText, { color: contentColor }]}>
            {label}
          </Text>
        </Pressable>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    padding: ThemeLayout.spacing.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  containerDesktop: {
    alignSelf: 'center',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  button: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.2,
  },
});
