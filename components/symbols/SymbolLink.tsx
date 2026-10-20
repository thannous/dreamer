import { Link, type Href } from 'expo-router';
import React, { useMemo, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/** Where a symbol's sheet was opened from, for its view event. */
export type SymbolDetailSource = 'dictionary' | 'search' | 'onboarding' | 'guide';

interface SymbolLinkProps extends Omit<PressableProps, 'style' | 'onPress' | 'children'> {
  symbolId: string;
  source: SymbolDetailSource;
  surfaceStyle: StyleProp<ViewStyle>;
  pressedStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Opens a symbol's sheet. Wrap the painting the sheet grows out of in `Link.AppleZoom`
 * (one child with a plain style object): on iOS 18 and later the system zoom carries it
 * into the sheet's painting and back. Elsewhere the sheet opens as before.
 */
export function SymbolLink({ symbolId, source, children, ...surface }: SymbolLinkProps) {
  const href = useMemo<Href>(
    () => ({ pathname: '/symbol-detail/[id]', params: { id: symbolId, source } }),
    [source, symbolId],
  );
  return (
    <Link href={href} asChild>
      <LinkSurface {...surface}>{children}</LinkSurface>
    </Link>
  );
}

// The Link hands its press and href to this child. Its prop merge spreads `style` as an
// object, which would drop a Pressable style function, so the pressed look lives here
// under another name. It stays a button for assistive technologies, as before the zoom.
function LinkSurface({ surfaceStyle, pressedStyle, ...props }: Omit<SymbolLinkProps, 'symbolId' | 'source'>) {
  return <Pressable {...props} role="button" style={({ pressed }) => [surfaceStyle, pressed && pressedStyle]} />;
}
