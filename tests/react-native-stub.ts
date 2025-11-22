export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';

export const Platform = {
  OS: 'web' as PlatformOSType,
  select: <T extends Record<string, any>>(obj: T): T[keyof T] | undefined => obj[Platform.OS] ?? obj.default,
};

export const NativeModules: Record<string, unknown> = {};

export default {
  Platform,
  NativeModules,
};
