import { useNotificationDreamImport } from '@/hooks/useNotificationDreamImport';
import { useSiriDreamCapture } from '@/hooks/useSiriDreamCapture';

/**
 * Headless host that saves dreams dictated from a reminder reply or told to
 * Siri. Mounted inside `DreamsProvider`, next to the other reminder hosts.
 */
export function NotificationDreamImportHost(): null {
  useSiriDreamCapture();
  useNotificationDreamImport();
  return null;
}

export default NotificationDreamImportHost;
