import Constants from 'expo-constants';
import { Platform } from 'react-native';

type AppVersionOptions = {
  prefix?: string;
};

const getBuildNumber = () => {
  const config = Constants?.expoConfig;
  const iosBuild = config?.ios?.buildNumber;
  const androidBuild = config?.android?.versionCode;

  if (Platform.OS === 'ios') {
    return iosBuild ?? null;
  }

  if (Platform.OS === 'android') {
    return androidBuild ?? null;
  }

  return iosBuild ?? androidBuild ?? null;
};

export const getAppVersionString = (options: AppVersionOptions = {}) => {
  const config = Constants?.expoConfig;
  const version = config?.version;
  if (!version) {
    return null;
  }

  const buildNumber = getBuildNumber();
  const buildLabel = buildNumber == null ? '' : ` (${buildNumber})`;
  const prefix = options.prefix ?? '';

  return `${prefix}${version}${buildLabel}`;
};
