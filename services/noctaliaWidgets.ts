import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { isLucidTrainer } from '@/lib/appVariant';
import { createScopedLogger } from '@/lib/logger';
import type { DreamCaptureWidgetProps } from '@/widgets/DreamCaptureWidget';
import type { LastDreamWidgetProps } from '@/widgets/LastDreamWidget';
import type { SleepTimerActivityProps } from '@/widgets/SleepTimerActivity';
import type { LiveActivity, LiveActivityFactory, Widget } from 'expo-widgets';

const log = createScopedLogger('[NoctaliaWidgets]');

type NoctaliaWidgets = {
  capture: Widget<DreamCaptureWidgetProps>;
  lastDream: Widget<LastDreamWidgetProps>;
  sleepTimer: LiveActivityFactory<SleepTimerActivityProps>;
  /** The folder the app and its widgets share, as a file:// URL. */
  directory: string | null;
};

let widgets: NoctaliaWidgets | null | undefined;

/**
 * The home and lock screen widgets and the sleep timer's Live Activity, when this binary
 * carries them: an iOS build made with expo-widgets. expo-widgets loads its native module
 * on import and throws where it is missing (a development build made before it, Expo Go),
 * so it is only required once the module is known to be there. Lucid has none of them.
 *
 * Requiring the widget files registers their layouts with the extension, which draws
 * nothing until the app has done so once after an install or an update.
 */
export function getNoctaliaWidgets(): NoctaliaWidgets | null {
  if (widgets !== undefined) return widgets;
  widgets = null;
  // A block rather than an early return, so Metro drops the widget layouts
  // (and @expo/ui's SwiftUI views) from the Android bundle.
  if (Platform.OS === 'ios' && !isLucidTrainer && requireOptionalNativeModule('ExpoWidgets')) {
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      widgets = {
        capture: require('@/widgets/DreamCaptureWidget').default,
        lastDream: require('@/widgets/LastDreamWidget').default,
        sleepTimer: require('@/widgets/SleepTimerActivity').default,
        directory: (require('expo-widgets') as typeof import('expo-widgets')).widgetsDirectory || null,
      };
      /* eslint-enable @typescript-eslint/no-require-imports */
    } catch (error) {
      log.warn('Widgets unavailable', error);
    }
  }
  return widgets;
}

/** A link into the app, in this build's scheme (noctalia, or noctalia-qa for QA). */
export function appLink(path: string, queryParams?: Record<string, string>): string {
  // Loaded with the widgets only: expo-linking reads the native config on import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('expo-linking') as typeof import('expo-linking')).createURL(path, { queryParams });
}

/** Names the capture widget in the app's language. */
export function updateCaptureWidget(label: string): void {
  const capture = getNoctaliaWidgets()?.capture;
  if (!capture) return;
  try {
    capture.updateSnapshot({ label, url: appLink('recording') });
  } catch (error) {
    log.warn('Capture widget not updated', error);
  }
}

let sleepTimer: LiveActivity<SleepTimerActivityProps> | null = null;

/**
 * Shows the sleep sound's countdown on the lock screen and in the Dynamic Island, or
 * moves it on: it pauses, resumes, or starts over. The system counts down by itself.
 */
export function showSleepTimer({ sound, caption, remainingMs, paused }: {
  sound: string;
  caption: string;
  remainingMs: number;
  paused: boolean;
}): void {
  const factory = getNoctaliaWidgets()?.sleepTimer;
  if (!factory) return;
  const now = Date.now();
  const props: SleepTimerActivityProps = { sound, caption, from: now, to: now + Math.max(0, remainingMs), paused };
  // Once the sound should be over, a countdown the app could not end turns stale and the
  // activity keeps only the sound's name. A paused one too, so it never waits all night.
  const staleDate = new Date(props.to + 60_000);
  try {
    if (sleepTimer) {
      void sleepTimer.update(props, staleDate).catch((error: unknown) => log.warn('Sleep timer update failed', error));
    } else {
      sleepTimer = factory.start(props, appLink('sleep-sounds'), staleDate);
    }
  } catch (error) {
    // Live Activities can be turned off in Settings: the sound plays on without one.
    log.warn('Sleep timer unavailable', error);
  }
}

/**
 * Takes the countdown off the lock screen, with any left by an earlier launch that ended
 * before it could: no sound plays when the app starts.
 */
export function endSleepTimer(): void {
  const factory = getNoctaliaWidgets()?.sleepTimer;
  const own = sleepTimer;
  sleepTimer = null;
  if (!factory) return;
  const activities = own ? [own] : [];
  try {
    for (const instance of factory.getInstances()) {
      if (instance.getId() !== own?.getId()) activities.push(instance);
    }
  } catch (error) {
    log.warn('Sleep timers could not be listed', error);
  }
  for (const activity of activities) {
    void activity.end('immediate').catch((error: unknown) => log.warn('Sleep timer end failed', error));
  }
}
