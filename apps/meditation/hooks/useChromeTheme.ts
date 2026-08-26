import { usePathname } from 'expo-router';

import { Themes, type ThemeMode } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useWorld } from '@/context/WorldContext';

/**
 * Shared navigator chrome follows the selected world only on the immersive
 * home. This does not mutate the user's app theme: catalogue and settings
 * screens continue to resolve from ThemeContext.
 */
export function useChromeTheme() {
  const pathname = usePathname();
  const { mode: appMode } = useTheme();
  const { world } = useWorld();
  const followsWorld = pathname === '/' || pathname === '/index';
  const mode: ThemeMode = followsWorld ? world.appearance : appMode;

  return { mode, colors: Themes[mode], followsWorld };
}
