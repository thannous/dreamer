// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import React, { ComponentProps } from 'react';
import { type ColorValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type SFSymbolName = Extract<SymbolViewProps['name'], string>;

/**
 * SF Symbols to Material Icons mappings, shared with the Noctalia journal app.
 *
 * The vocabulary is SF Symbol names, everywhere: `expo-symbols` renders them
 * natively on iOS, and this table translates them for Android and web. Two apps
 * of the same brand sitting side by side on a phone have to share an icon
 * family, which is why this is a copy of the journal app's file rather than a
 * set of our own.
 *
 * The mapping is deliberately partial — anything unmapped falls back to a
 * generic icon, so Android and web never render `undefined`.
 */
const MAPPING: Partial<Record<SFSymbolName, MaterialIconName>> = {
  // Tab bar
  house: 'home',
  'house.fill': 'home',
  'wind': 'air',
  magnifyingglass: 'search',
  person: 'person-outline',
  'person.fill': 'person',

  // Player transport
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  // MaterialIcons only ships replay-5/10/30, so the numbered variants would
  // print "10" on a button that skips 15 seconds. A generic circular arrow says
  // less and lies about nothing; iOS still gets the exact numbered symbol.
  'gobackward.15': 'rotate-left',
  'goforward.15': 'rotate-right',
  'speaker.wave.2.fill': 'volume-up',
  'moon.zzz': 'bedtime',

  // Navigation and actions
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  'line.3.horizontal': 'menu',
  xmark: 'close',
  plus: 'add',
  minus: 'remove',
  checkmark: 'check',

  // Library
  bookmark: 'bookmark-border',
  'bookmark.fill': 'bookmark',
  'flame.fill': 'local-fire-department',
  clock: 'schedule',
  bell: 'notifications-none',
  gear: 'settings',
  globe: 'language',
  'info.circle': 'info',
  'questionmark.circle': 'help-outline',
  'lock.shield': 'enhanced-encryption',
  photo: 'photo',
  trash: 'delete',
  'moon.stars.fill': 'nights-stay',
  sparkles: 'auto-awesome',
  'cloud.rain.fill': 'grain',
  'water.waves': 'waves',
  waveform: 'graphic-eq',
  calendar: 'event',
};

/**
 * Native SF Symbols on iOS, Material Icons on Android and web. Icon `name`s are
 * SF Symbols and need a manual mapping above.
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
