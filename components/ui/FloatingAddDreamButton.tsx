import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DreamIcon } from '@/components/icons/DreamIcons';
import { ThemeLayout } from '@/constants/journalTheme';
import { LAYOUT_MAX_WIDTH } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { MotiView } from '@/lib/moti';

const COMPACT_BUTTON_SIZE = 56;
const COMPACT_BUTTON_EXPANDED_WIDTH = 220;

type FloatingAddDreamButtonProps = {
  onPress: () => void;
  label: string;
  accessibilityLabel: string;
  bottomOffset: number;
  isDesktopLayout?: boolean;
  compactLabelVisible?: boolean;
  testID?: string;
  animationDelay?: number;
};

export function FloatingAddDreamButton({
  onPress,
  label,
  accessibilityLabel,
  bottomOffset,
  isDesktopLayout = false,
  compactLabelVisible = true,
  testID,
  animationDelay = 400,
}: FloatingAddDreamButtonProps) {
  const { colors } = useTheme();
  const contentColor = colors.textOnAccentSurface;
  const isCompact = !isDesktopLayout;
  const showLabel = !isCompact || compactLabelVisible;
  const animatedCompactWidth = showLabel ? COMPACT_BUTTON_EXPANDED_WIDTH : COMPACT_BUTTON_SIZE;

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
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
            styles.pressableFrame,
            pressed && styles.buttonPressed,
          ]}
          onPress={onPress}
          accessibilityRole="button"
          testID={testID}
          accessibilityLabel={accessibilityLabel}
        >
          <MotiView
            animate={
              isCompact
                ? {
                    width: animatedCompactWidth,
                    paddingHorizontal: showLabel ? 18 : 0,
                  }
                : {}
            }
            transition={{
              type: 'timing',
              duration: 240,
            }}
            style={[
              styles.button,
              isCompact && styles.buttonCompact,
              !isCompact && styles.buttonDesktop,
              { backgroundColor: colors.accent },
            ]}
          >
            <DreamIcon size={22} color={contentColor} />
            {isCompact ? (
              <MotiView
                animate={{
                  opacity: showLabel ? 1 : 0,
                  translateX: showLabel ? 0 : 8,
                  width: showLabel ? COMPACT_BUTTON_EXPANDED_WIDTH - 74 : 0,
                  marginLeft: showLabel ? 10 : 0,
                }}
                transition={{
                  type: 'timing',
                  duration: showLabel ? 220 : 160,
                }}
                style={styles.labelClip}
              >
                <Text
                  style={[styles.buttonText, { color: contentColor }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </MotiView>
            ) : (
              <Text
                style={[styles.buttonText, { color: contentColor }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            )}
          </MotiView>
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
  containerCompact: {
    alignItems: 'flex-end',
    paddingRight: ThemeLayout.spacing.lg,
  },
  containerDesktop: {
    alignSelf: 'center',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  pressableFrame: {
    borderRadius: ThemeLayout.borderRadius.full,
  },
  button: {
    minHeight: COMPACT_BUTTON_SIZE,
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonCompact: {
    height: COMPACT_BUTTON_SIZE,
  },
  buttonDesktop: {
    paddingHorizontal: 28,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  labelClip: {
    overflow: 'hidden',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.2,
  },
});
