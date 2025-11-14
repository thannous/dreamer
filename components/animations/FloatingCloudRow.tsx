import { memo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MotiView } from 'moti';

const { width } = Dimensions.get('window');

type FloatingCloudRowProps = {
  top: number;
  delay?: number;
  opacity?: number;
  reverse?: boolean;
};

function FloatingCloudRowComponent({ top, delay = 0, opacity = 0.4, reverse = false }: FloatingCloudRowProps) {
  const travel = width + 220;

  return (
    <MotiView
      style={[styles.cloudContainer, { top }]}
      from={{ translateX: reverse ? travel : -travel, opacity: 0 }}
      animate={{ translateX: reverse ? -travel : travel, opacity }}
      transition={{
        type: 'timing',
        duration: 38000,
        delay,
        loop: true,
        repeatReverse: true,
      }}
    >
      <Svg width={220} height={90} viewBox="0 0 220 90">
        <Circle cx="60" cy="50" r="34" fill="rgba(255,255,255,0.18)" />
        <Circle cx="110" cy="45" r="40" fill="rgba(255,255,255,0.16)" />
        <Circle cx="150" cy="55" r="30" fill="rgba(255,255,255,0.18)" />
        <Circle cx="95" cy="65" r="28" fill="rgba(255,255,255,0.14)" />
        <Circle cx="135" cy="68" r="26" fill="rgba(255,255,255,0.14)" />
      </Svg>
    </MotiView>
  );
}

export const FloatingCloudRow = memo(FloatingCloudRowComponent);

const styles = StyleSheet.create({
  cloudContainer: {
    position: 'absolute',
    left: -110,
  },
});
