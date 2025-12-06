import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

interface EmailVerificationIconProps {
  size?: number;
  color?: string;
  verified?: boolean;
  successColor?: string;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function EmailVerificationIcon({
  size = 64,
  color = '#8C9EFF',
  verified = false,
  successColor = '#16A34A',
}: EmailVerificationIconProps) {
  const pulseOpacity = useSharedValue(1);
  const checkScale = useSharedValue(0);

  // Pulse animation when waiting
  useEffect(() => {
    if (!verified) {
      pulseOpacity.value = withRepeat(
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [verified, pulseOpacity]);

  // Checkmark scale animation when verified
  useEffect(() => {
    if (verified) {
      checkScale.value = withSpring(1, {
        damping: 12,
        stiffness: 180,
      });
    } else {
      checkScale.value = 0;
    }
  }, [verified, checkScale]);

  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const iconColor = verified ? successColor : color;
  const badgeSize = size * 0.4;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <AnimatedView style={envelopeStyle}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {/* Envelope body */}
          <Path
            d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"
            stroke={iconColor}
            strokeWidth={1.5}
            fill="none"
          />
          {/* Envelope flap */}
          <Path
            d="M22 6l-10 7L2 6"
            stroke={iconColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </AnimatedView>

      {/* Success badge with checkmark */}
      <AnimatedView style={[styles.badge, checkmarkStyle, { width: badgeSize, height: badgeSize }]}>
        <Svg width={badgeSize} height={badgeSize} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={12} fill={successColor} />
          <Path
            d="M6.5 12.5l3 3 8-8"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});

export default EmailVerificationIcon;
