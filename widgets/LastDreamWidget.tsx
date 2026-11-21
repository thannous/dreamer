import { HStack, Image, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  clipped,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  widgetAccentedRenderingMode,
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
  /** The same day without its weekday, for the small widget: the full date is cut there. */
  shortDate?: string;
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

  const ink = dark ? '#FFF9EF' : '#382D35';
  const accented = environment.widgetRenderingMode === 'accented';
  const textStyle = accented ? [] : [foregroundStyle(ink)];
  const medium = environment.widgetFamily === 'systemMedium';
  // The small widget takes the short date, and an anniversary's words may wrap there.
  const above = props.eyebrow ?? (medium ? props.date : props.shortDate ?? props.date);
  const named = accessibilityLabel([props.eyebrow, props.title, props.date].filter(Boolean).join(', '));
  const caption = (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[accented ? frame({ maxWidth: Infinity, alignment: 'leading' }) : padding({ horizontal: 14, bottom: 12 })]}
    >
      {above ? (
        <Text modifiers={[font({ size: 11, weight: 'medium' }), ...textStyle, lineLimit(medium ? 1 : 2)]}>{above}</Text>
      ) : null}
      <Text modifiers={[font({ size: medium ? 18 : 15, weight: 'semibold', design: 'serif' }), ...textStyle, lineLimit(2)]}>
        {props.title}
      </Text>
    </VStack>
  );

  // Clear and tinted Home Screens turn an opaque image white. Keep the artwork in colour
  // and set the caption outside it so WidgetKit can style the text against its glass surface.
  if (accented) {
    const Stack = medium ? HStack : VStack;
    return (
      <Stack spacing={8} modifiers={[open, fill, padding({ all: 10 }), containerBackground('transparent', 'widget'), named]}>
        <Image
          uiImage={props.image}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fill' }),
            medium ? frame({ width: 86, height: 94 }) : frame({ maxWidth: Infinity, minHeight: 52, maxHeight: 52 }),
            clipped(),
            cornerRadius(8),
            widgetAccentedRenderingMode('fullColor'),
          ]}
        />
        {caption}
      </Stack>
    );
  }

  // A gradient behind the title keeps it legible on light and dark paintings.
  const veil = dark ? ['rgba(3, 4, 13, 0)', 'rgba(3, 4, 13, 0.86)'] : ['rgba(245, 234, 219, 0)', 'rgba(245, 234, 219, 0.92)'];

  return (
    <ZStack alignment="bottomLeading" modifiers={[open, fill, containerBackground(ground, 'widget'), named]}>
      <Image uiImage={props.image} modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), fill, clipped()]} />
      <Rectangle
        modifiers={[
          fill,
          foregroundStyle({ type: 'linearGradient', colors: veil, startPoint: { x: 0.5, y: 0.35 }, endPoint: { x: 0.5, y: 1 } }),
        ]}
      />
      {caption}
    </ZStack>
  );
};

export default createWidget<LastDreamWidgetProps>('LastDream', LastDreamWidget, {
  url: 'noctalia://recording',
  empty: 'Ton prochain rêve peint apparaîtra ici.',
});
