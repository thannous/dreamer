import { AccessoryWidgetBackground, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type DreamCaptureWidgetProps = {
  /** « Raconter mon rêve », in the app's language. */
  label: string;
  /** Opens the capture screen. */
  url: string;
};

/**
 * One tap from the lock screen or the home screen to the capture screen, before the
 * dream fades. The widget runtime draws it without the app: it imports nothing, and
 * its colours are the palette's night and paper (constants/noctaliaPalette.ts).
 */
const DreamCaptureWidget = (props: DreamCaptureWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const open = widgetURL(props.url);
  const named = accessibilityLabel(props.label);
  // The lock screen draws its own material behind accessory widgets.
  const bare = containerBackground('transparent', 'widget');

  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <ZStack modifiers={[open, named, bare]}>
        <AccessoryWidgetBackground />
        <Image systemName="moon.stars.fill" modifiers={[font({ size: 22, weight: 'semibold' })]} />
      </ZStack>
    );
  }

  if (environment.widgetFamily === 'accessoryInline') {
    return <Text modifiers={[open, bare]}>{props.label}</Text>;
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[open, named, bare, frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Image systemName="moon.stars.fill" modifiers={[font({ size: 15, weight: 'semibold' })]} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{props.label}</Text>
      </VStack>
    );
  }

  const dark = environment.colorScheme !== 'light';
  const ground = dark ? ['#14131A', '#03040D'] : ['#F5EADB', '#F0E4D4'];
  const title = dark ? '#FFF9EF' : '#382D35';
  const accent = dark ? '#EAD4B4' : '#7C4C2B';
  const muted = dark ? '#B7AEC9' : '#64514F';

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        open,
        named,
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'bottomLeading' }),
        padding({ all: 4 }),
        containerBackground(
          { type: 'linearGradient', colors: ground, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
          'widget',
        ),
      ]}
    >
      <Image systemName="moon.stars.fill" modifiers={[font({ size: 26, weight: 'semibold' }), foregroundStyle(accent)]} />
      <Text modifiers={[font({ size: 19, weight: 'semibold', design: 'serif' }), foregroundStyle(title), lineLimit(3)]}>
        {props.label}
      </Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>Noctalia</Text>
    </VStack>
  );
};

export default createWidget<DreamCaptureWidgetProps>('DreamCapture', DreamCaptureWidget, {
  label: 'Raconter mon rêve',
  url: 'noctalia://recording',
});
