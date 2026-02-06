// Fallback for using MaterialIcons on Android and web.

import React, { ComponentProps } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { type ColorValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type SFSymbolName = SymbolViewProps['name'];

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 *
 * Note: This mapping is intentionally partial. If we don't have a mapping for a symbol,
 * we fall back to a generic icon so Android/web never render `undefined`.
 */
const MAPPING: Partial<Record<SFSymbolName, MaterialIconName>> = {
  // Filled icons
  'house.fill': 'home',
  'book.fill': 'menu-book',
  'chart.bar.fill': 'insert-chart',
  'chart.pie.fill': 'pie-chart',
  'checkmark.circle.fill': 'check-circle',
  'flame.fill': 'local-fire-department',
  'heart.fill': 'favorite',
  'lock.fill': 'lock',
  'paperplane.fill': 'send',
  'star.fill': 'star',
  gear: 'settings',
  // Outline icons for navbar
  house: 'home',
  book: 'menu-book',
  'chart.bar': 'bar-chart',
  'arrow.clockwise': 'refresh',
  'arrow.down': 'arrow-downward',
  'arrow.up.circle': 'arrow-circle-up',
  'bubble.left.and.bubble.right': 'chat-bubble-outline',
  'bubble.left.and.bubble.right.fill': 'chat-bubble',
  camera: 'camera-alt',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  checkmark: 'check',
  'doc.on.doc': 'content-copy',
  'exclamationmark.circle.fill': 'error',
  'exclamationmark.triangle': 'warning',
  'exclamationmark.triangle.fill': 'warning',
  'g.circle.fill': 'g-translate',
  globe: 'language',
  heart: 'favorite-border',
  hourglass: 'hourglass-empty',
  clock: 'schedule',
  'info.circle': 'info',
  iphone: 'phone-iphone',
  mic: 'mic',
  'mic.fill': 'mic',
  paintpalette: 'palette',
  'paintpalette.fill': 'palette',
  photo: 'photo',
  'photo.on.rectangle': 'photo-library',
  'person.fill': 'person',
  'square.and.arrow.up': 'share',
  stop: 'stop',
  'stop.fill': 'stop',
  'sun.max.fill': 'sunny',
  trash: 'delete',
  xmark: 'close',
  'sparkles': 'auto-awesome',
  'lightbulb.fill': 'lightbulb',
  'moon.stars.fill': 'nights-stay',
  'quote.opening': 'format-quote',
  'figure.walk': 'directions-walk',
  calendar: 'event',
  pencil: 'edit',
  'arrow.triangle.2.circlepath': 'autorenew',
  'person.crop.circle.badge.exclamationmark': 'account-circle',
  // Symbol dictionary category icons
  'leaf.fill': 'eco',
  'pawprint.fill': 'pets',
  'building.2.fill': 'location-city',
  'cube.fill': 'category',
  'bolt.fill': 'flash-on',
  'person.2.fill': 'people',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'cancel',
  'questionmark.circle.fill': 'help',
  'arrow.right': 'arrow-forward',
  // Per-symbol icons
  'drop.fill': 'water-drop',
  'arrow.down.to.line': 'downhill-skiing',
  'bird.fill': 'flight',
  'eye.fill': 'visibility',
  'heart.slash.fill': 'heart-broken',
  'figure.run': 'directions-run',
  brain: 'psychology',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: SFSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle | ViewStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name] ?? 'help';
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={mappedName}
      style={style as StyleProp<TextStyle>}
    />
  );
}
