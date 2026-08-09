export type ExpoImageManipulatorModule = typeof import('expo-image-manipulator');
export type ExpoImagePickerModule = typeof import('expo-image-picker');

export function loadExpoImageManipulatorModule(): Promise<ExpoImageManipulatorModule> {
  return import('expo-image-manipulator');
}

export function loadExpoImagePickerModule(): Promise<ExpoImagePickerModule> {
  return import('expo-image-picker');
}
