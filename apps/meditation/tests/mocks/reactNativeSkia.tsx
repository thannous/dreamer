import React from 'react';
import { View, type ViewProps } from 'react-native';

type SkiaNodeProps = React.PropsWithChildren<Record<string, unknown>>;

const SkiaNode = ({ children }: SkiaNodeProps) => <>{children}</>;

/** Unit tests assert composition; the real pixels are validated on-device. */
export const Canvas = ({ children, ...props }: React.PropsWithChildren<ViewProps>) => (
  <View {...props} testID="mock-skia-canvas">
    {children}
  </View>
);
export const BlurMask = SkiaNode;
export const Circle = SkiaNode;
export const Group = SkiaNode;
export const Oval = SkiaNode;
export const RadialGradient = SkiaNode;
