// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Filled icons
  'house.fill': 'home',
  'book.fill': 'menu-book',
  'chart.bar.fill': 'insert-chart',
  gear: 'settings',
  // Outline icons for navbar
  house: 'home',
  book: 'menu-book',
  'chart.bar': 'bar-chart',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
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
} as IconMapping;

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
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
