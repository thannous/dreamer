import React from 'react';

type IconProps = {
  name?: string;
  testID?: string;
  [key: string]: any;
};

const createIcon = () => {
  const Icon = ({ name, testID, ...props }: IconProps) =>
    React.createElement('span', { 'data-testid': testID ?? (name ? `icon-${name}` : undefined), ...props });
  (Icon as any).glyphMap = {};
  return Icon;
};

export const Ionicons = createIcon();
export const MaterialCommunityIcons = createIcon();
export const MaterialIcons = createIcon();

export default {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
};
