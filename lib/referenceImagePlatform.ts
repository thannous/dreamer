export type ExpoCameraModule = typeof import('expo-camera');
export type ExpoImageManipulatorModule = typeof import('expo-image-manipulator');
export type ExpoImagePickerModule = typeof import('expo-image-picker');

export function loadExpoCameraModule(): Promise<ExpoCameraModule> {
  return import('expo-camera');
}

export function loadExpoImageManipulatorModule(): Promise<ExpoImageManipulatorModule> {
  return import('expo-image-manipulator');
}

export function loadExpoImagePickerModule(): Promise<ExpoImagePickerModule> {
  return import('expo-image-picker');
}
