import { usePathname } from 'expo-router';

import { Themes, type ThemeMode } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useWorld } from '@/context/WorldContext';

const WORLD_TAB_PATHS = new Set(['/', '/index', '/breathe', '/search', '/profile']);

/**
 * Shared navigator chrome follows the active world across the four immersive
 * tabs. Locked previews only affect Home; routes outside the tabs continue to
 * resolve from ThemeContext.
 */
export function useChromeTheme() {
  const pathname = usePathname();
  const { mode: appMode } = useTheme();
  const { world, presentationWorld } = useWorld();
  const isHome = pathname === '/' || pathname === '/index';
  const followsWorld = WORLD_TAB_PATHS.has(pathname);
  const chromeWorld = isHome ? presentationWorld : world;
  const mode: ThemeMode = followsWorld ? chromeWorld.appearance : appMode;

  return { mode, colors: Themes[mode], followsWorld };
}
