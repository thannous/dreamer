import { useIsFocused } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';

/**
 * Light clock and battery while night artwork sits under them. Tabs stay
 * mounted, so only the focused screen may push this entry; the root layout's
 * theme style comes back once the page scrolls onto its light ground.
 */
export function LucidArtStatusBar({ overArt }: { overArt: boolean }) {
  const focused = useIsFocused();
  return focused && overArt ? <SystemBars style={{ statusBar: 'light' }} /> : null;
}
