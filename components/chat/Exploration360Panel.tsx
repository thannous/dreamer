import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { Exploration360Progress } from '@/lib/exploration360';
import { TID } from '@/lib/testIDs';

type Exploration360PanelProps = {
  progress: Exploration360Progress;
  hasSynthesis: boolean;
  onSynthesisPress?: () => void;
  synthesisDisabled?: boolean;
  animationDelay?: number;
  style?: ViewStyle;
};

export function Exploration360Panel({
  progress,
  hasSynthesis,
  onSynthesisPress,
  synthesisDisabled = false,
  animationDelay = 0,
  style,
}: Exploration360PanelProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const bodyKey = hasSynthesis
    ? 'dream_categories.exploration360.body.done'
    : progress.isComplete
      ? 'dream_categories.exploration360.body.ready'
      : 'dream_categories.exploration360.body.incomplete';
  const showSynthesisCta = progress.isComplete && !hasSynthesis && Boolean(onSynthesisPress);
  const cardStyle = StyleSheet.flatten([styles.card, style]);

  return (
    <FlatGlassCard
      intensity="moderate"
      animationDelay={animationDelay}
      style={cardStyle}
      testID={TID.Component.Exploration360Panel}
    >
      <View style={[styles.accent, { backgroundColor: colors.accent }]} />
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: mode === 'dark' ? `${colors.accent}2E` : `${colors.accent}18` },
            ]}
          >
            <IconSymbol name="sparkles" size={21} color={colors.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {t('dream_categories.exploration360.eyebrow')}
            </Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('dream_categories.exploration360.title')}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t(bodyKey)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.progressPill,
            {
              borderColor: `${colors.accent}55`,
              backgroundColor: mode === 'dark' ? `${colors.accent}22` : `${colors.accent}13`,
            },
          ]}
        >
          <IconSymbol
            name={progress.isComplete ? 'checkmark.circle.fill' : 'bubble.left.and.bubble.right'}
            size={15}
            color={colors.accent}
          />
          <Text style={[styles.progressText, { color: colors.textPrimary }]}>
            {t('dream_categories.exploration360.progress', {
              completed: progress.completedCount,
              total: progress.totalCount,
            })}
          </Text>
        </View>

        <View style={styles.axisGrid}>
          {progress.axes.map((axis) => (
            <View
              key={axis.id}
              style={[
                styles.axisItem,
                {
                  borderColor: axis.completed ? `${colors.accent}66` : colors.divider,
                  backgroundColor: axis.completed
                    ? mode === 'dark' ? `${colors.accent}1F` : `${colors.accent}10`
                    : mode === 'dark' ? `${colors.backgroundSecondary}B8` : `${colors.backgroundSecondary}90`,
                },
              ]}
            >
              <View style={styles.axisHeader}>
                <IconSymbol
                  name={axis.completed ? 'checkmark.circle.fill' : 'hourglass'}
                  size={15}
                  color={axis.completed ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.axisTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t(axis.titleKey)}
                </Text>
              </View>
              <Text style={[styles.axisState, { color: colors.textSecondary }]}>
                {axis.completed
                  ? t('dream_categories.exploration360.step.done')
                  : t('dream_categories.exploration360.step.next')}
              </Text>
            </View>
          ))}
        </View>

        {showSynthesisCta ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dream_categories.exploration360.synthesis.cta')}
            testID={TID.Button.Exploration360Synthesis}
            onPress={synthesisDisabled ? undefined : onSynthesisPress}
            style={({ pressed }) => [
              styles.synthesisButton,
              { backgroundColor: colors.accent },
              synthesisDisabled && styles.synthesisButtonDisabled,
              pressed && !synthesisDisabled && styles.pressed,
            ]}
          >
            <Text style={[styles.synthesisButtonText, { color: colors.textOnAccentSurface }]}>
              {t('dream_categories.exploration360.synthesis.cta')}
            </Text>
            <IconSymbol name="arrow.right" size={16} color={colors.textOnAccentSurface} />
          </Pressable>
        ) : hasSynthesis ? (
          <View
            style={[
              styles.donePill,
              {
                borderColor: `${colors.accent}55`,
                backgroundColor: mode === 'dark' ? `${colors.accent}22` : `${colors.accent}13`,
              },
            ]}
          >
            <IconSymbol name="checkmark.circle.fill" size={16} color={colors.accent} />
            <Text style={[styles.doneText, { color: colors.textPrimary }]}>
              {t('dream_categories.exploration360.synthesis.done')}
            </Text>
          </View>
        ) : null}
      </View>
    </FlatGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    padding: 0,
  },
  accent: {
    height: 3,
    opacity: 0.9,
  },
  inner: {
    padding: 16,
    gap: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.medium,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: Fonts.fraunces.semiBold,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  progressPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  progressText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  axisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  axisItem: {
    flex: 1,
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 10,
    gap: 5,
  },
  axisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  axisTitle: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  axisState: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  synthesisButton: {
    minHeight: 46,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  synthesisButtonDisabled: {
    opacity: 0.55,
  },
  synthesisButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  donePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 32,
    paddingHorizontal: 11,
  },
  doneText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
