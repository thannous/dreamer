import { Platform } from 'react-native';

import {
  fillMaxWidth,
  onGloballyPositioned,
  selectable,
} from '@expo/ui/jetpack-compose/modifiers';
import { frame as swiftFrame } from '@expo/ui/swift-ui/modifiers';

type GlobalLayout = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const fullWidthNativeModifiers = Platform.OS === 'android'
  ? [fillMaxWidth()]
  : [swiftFrame({ maxWidth: Infinity })];

export const shouldGateHostedRNInteraction = Platform.OS === 'android';

export function getSelectableModifiers(
  selected: boolean,
  onSelect: () => void,
) {
  return Platform.OS === 'android'
    ? [...fullWidthNativeModifiers, selectable(selected, onSelect, 'radioButton')]
    : fullWidthNativeModifiers;
}

export function getGlobalPositionModifiers(
  handler: (layout: GlobalLayout) => void,
) {
  return Platform.OS === 'android' ? [onGloballyPositioned(handler)] : undefined;
}
