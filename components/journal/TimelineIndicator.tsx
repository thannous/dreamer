import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { getDreamIcon, DreamIconType } from '@/constants/dreamIcons';
import {
  PlaneIcon,
  BrainIcon,
  GearIcon,
  WaveIcon,
  StarIcon,
  HeartIcon,
  BoltIcon,
  EyeIcon,
  DreamIcon,
} from '@/components/icons/DreamIcons';

interface TimelineIndicatorProps {
  dreamType: string;
}

const ICON_COMPONENTS: Record<DreamIconType, React.ComponentType<{ size?: number; color?: string }>> = {
  plane: PlaneIcon,
  brain: BrainIcon,
  gear: GearIcon,
  wave: WaveIcon,
  star: StarIcon,
  heart: HeartIcon,
  bolt: BoltIcon,
  eye: EyeIcon,
  dream: DreamIcon,
};

export const TimelineIndicator = memo(function TimelineIndicator({ dreamType }: TimelineIndicatorProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const iconType = getDreamIcon(dreamType);
  const IconComponent = ICON_COMPONENTS[iconType];

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: noctalia.action.primary }]}>
        <IconComponent size={18} color={noctalia.action.primaryText} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 6,
  },
  iconCircle: {
    width: ThemeLayout.timelineIconContainerSize,
    height: ThemeLayout.timelineIconContainerSize,
    borderRadius: ThemeLayout.timelineIconContainerSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
