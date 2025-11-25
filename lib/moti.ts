// Re-export Moti components without triggering the package entry that pulls the deprecated
// React Native SafeAreaView. Deep imports keep our bundle free of the deprecation warning.
export { View as MotiView } from 'moti/build/components/view';
export { Text as MotiText } from 'moti/build/components/text';
