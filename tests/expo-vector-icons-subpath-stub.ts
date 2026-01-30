import React from 'react';

type IconProps = {
  name?: string;
  testID?: string;
  [key: string]: any;
};

const IconComponent = ({ name, testID, ...props }: IconProps) =>
  React.createElement('span', { 'data-testid': testID ?? (name ? `icon-${name}` : undefined), ...props });

(IconComponent as any).glyphMap = {};

export default IconComponent;
