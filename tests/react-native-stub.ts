import React from 'react';

export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';

export const Platform = {
  OS: 'web' as PlatformOSType,
  select: <T extends Record<string, any>>(obj: T): T[keyof T] | undefined => obj[Platform.OS] ?? obj.default,
};

export const NativeModules: Record<string, unknown> = {};

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown';

export const AppState = {
  currentState: 'active' as AppStateStatus,
  addEventListener: (_event: 'change', _listener: (state: AppStateStatus) => void) => {
    return { remove: () => {} };
  },
};

export const Alert = {
  alert: () => {},
};

export const ActivityIndicator = (props: any) =>
  React.createElement('div', { ...props, 'data-testid': props?.testID ?? props?.['data-testid'] });

export const Animated = {
  Value: class {
    value: number;
    constructor(value: number) {
      this.value = value;
    }
    setValue(next: number) {
      this.value = next;
    }
    interpolate() {
      return this;
    }
  },
  View: ({ children }: any) => React.createElement('div', null, children),
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
  parallel: () => ({ start: (cb?: () => void) => cb?.() }),
};

export const Easing = {
  ease: 'ease',
  in: () => 'in',
  out: () => 'out',
  inOut: () => 'inOut',
};

export const Pressable = ({ children, onPress, disabled, testID }: any) =>
  React.createElement(
    'button',
    { 'data-testid': testID, disabled, onClick: onPress },
    typeof children === 'function' ? children({ pressed: false }) : children
  );

export const StyleSheet = {
  create: (styles: any) => styles,
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
};

export const Text = ({ children, testID }: any) =>
  React.createElement('span', { 'data-testid': testID }, children);

export const TextInput = ({ onChangeText, value, testID }: any) =>
  React.createElement('input', {
    'data-testid': testID,
    value,
    onChange: (event: any) => onChangeText?.(event.target.value),
  });

export const View = ({ children }: any) => React.createElement('div', null, children);

export const Modal = ({ visible, children }: any) =>
  visible ? React.createElement('div', null, children) : null;

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const useWindowDimensions = () => ({
  width: 375,
  height: 812,
  scale: 2,
  fontScale: 1,
});

export const Keyboard = {
  dismiss: () => {},
};

export const KeyboardAvoidingView = ({ children }: any) => React.createElement('div', null, children);

export const ScrollView = ({ children }: any) => React.createElement('div', null, children);

export const TouchableWithoutFeedback = ({ children, onPress }: any) =>
  React.createElement('div', { onClick: onPress }, children);

export default {
  Platform,
  NativeModules,
};
