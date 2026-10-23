import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

interface IconProps {
  size?: number;
  color?: string;
}

interface EyeOffIconProps extends IconProps {
  slashColor?: string;
}

function useFallbackIconColor(color?: string) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  return color ?? noctalia.text.primary;
}

// Eye icon - for vision, revelation dreams
export function EyeIcon({ size = 24, color }: IconProps) {
  const iconColor = useFallbackIconColor(color);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
        fill={iconColor}
      />
    </Svg>
  );
}

// Eye off icon - for hidden content
export function EyeOffIcon({ size = 24, color, slashColor }: EyeOffIconProps) {
  const iconColor = useFallbackIconColor(color);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
        fill={iconColor}
      />
      <Path
        d="M4 4l16 16"
        stroke={slashColor ?? iconColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
