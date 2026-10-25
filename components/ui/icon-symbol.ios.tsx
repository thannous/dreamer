import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  // Decorative, as on Android, where the icon font says nothing: iOS would otherwise read the
  // symbol's own name ("lock", "filled person icon"), alone or inside its button's label.
  // A button that is only an icon carries its own accessibility label.
  return (
    <SymbolView
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
