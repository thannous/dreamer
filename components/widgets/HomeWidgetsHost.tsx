import { useHomeWidgets } from '@/hooks/useHomeWidgets';

/**
 * Headless host for the iOS widgets. Mounted inside `DreamsProvider` so the last painted
 * dream follows every journal change, wherever it came from.
 */
export function HomeWidgetsHost(): null {
  useHomeWidgets();
  return null;
}

export default HomeWidgetsHost;
