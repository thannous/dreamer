import { Image, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

// Left out rather than null: the props are kept in the widgets' shared settings, which
// cannot hold a null.
export type LastDreamWidgetProps = {
  /** The painting, copied into the widgets' shared folder; absent before the first one. */
  image?: string;
  /** The dream's title, absent before the first painted dream. */
  title?: string;
  /** When it was dreamt, already written in the app's language. */
  date?: string;
  /** Instead of the date on an anniversary: « Il y a un mois cette nuit ». */
  eyebrow?: string;
  /** Opens that dream, or the capture screen before the first one. */
  url: string;
  /** Shown before the first painted dream. */
  empty: string;
};

/**
 * The last painted dream on the home screen, its title laid on the painting; a tap opens
 * it. The widget runtime draws it without the app: it imports nothing, and its colours
 * are the palette's night and paper (constants/noctaliaPalette.ts).
 */
const LastDreamWidget = (props: LastDreamWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme !== 'light';
  const ground = dark ? '#03040D' : '#F0E4D4';
  const open = widgetURL(props.url);
  // From zero: a painting filling its frame would otherwise grow the widget to its own 9:16.
  const fill = frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity });

  if (!props.image || !props.title) {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          open,
          fill,
          padding({ all: 16 }),
          containerBackground(ground, 'widget'),
        ]}
      >
        <Image systemName="moon.stars.fill" modifiers={[font({ size: 24, weight: 'semibold' }), foregroundStyle(dark ? '#EAD4B4' : '#7C4C2B')]} />
        <Text modifiers={[font({ size: 15, weight: 'medium', design: 'serif' }), foregroundStyle(dark ? '#FFF9EF' : '#382D35'), lineLimit(4)]}>
          {props.empty}
        </Text>
      </VStack>
    );
  }

  // The title keeps the illustration's fixed contrast: a near-opaque band of the theme's
  // own ground fading up into the painting, whatever the painting's light.
  const ink = dark ? '#FFF9EF' : '#382D35';
  const veil = dark ? ['rgba(3, 4, 13, 0)', 'rgba(3, 4, 13, 0.86)'] : ['rgba(245, 234, 219, 0)', 'rgba(245, 234, 219, 0.92)'];
  const medium = environment.widgetFamily === 'systemMedium';

  return (
    <ZStack alignment="bottomLeading" modifiers={[open, fill, containerBackground(ground, 'widget'), accessibilityLabel([props.eyebrow, props.title, props.date].filter(Boolean).join(', '))]}>
      <Image uiImage={props.image} modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), fill, clipped()]} />
      <Rectangle
        modifiers={[
          fill,
          foregroundStyle({ type: 'linearGradient', colors: veil, startPoint: { x: 0.5, y: 0.35 }, endPoint: { x: 0.5, y: 1 } }),
        ]}
      />
      <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 14, bottom: 12 })]}>
        {props.eyebrow || props.date ? (
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(ink), lineLimit(1)]}>{props.eyebrow ?? props.date}</Text>
        ) : null}
        <Text modifiers={[font({ size: medium ? 18 : 15, weight: 'semibold', design: 'serif' }), foregroundStyle(ink), lineLimit(2)]}>
          {props.title}
        </Text>
      </VStack>
    </ZStack>
  );
};

export default createWidget<LastDreamWidgetProps>('LastDream', LastDreamWidget, {
  url: 'noctalia://recording',
  empty: 'Ton prochain rêve peint apparaîtra ici.',
});
