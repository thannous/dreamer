import { useNotificationDreamImport } from '@/hooks/useNotificationDreamImport';

/**
 * Headless host that saves dreams dictated from a reminder reply. Mounted
 * inside `DreamsProvider`, next to the other reminder hosts.
 */
export function NotificationDreamImportHost(): null {
  useNotificationDreamImport();
  return null;
}

export default NotificationDreamImportHost;
