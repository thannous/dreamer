import { Text as MotiText } from 'moti/build/components/text';
import { View as MotiView } from 'moti/build/components/view';
import useDynamicAnimation from 'moti/build/core/use-dynamic-animation';

// Avoid the root `moti` entrypoint to prevent pulling in the deprecated React Native SafeAreaView.
export { MotiText, MotiView, useDynamicAnimation };
