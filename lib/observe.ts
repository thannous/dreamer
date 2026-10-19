import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import type React from 'react';

import { isLucidTrainer } from '@/lib/appVariant';

type ObserveModule = typeof import('expo-observe');

const STABILITY_REPORTS_KEY = 'noctalia_stability_reports_v1';

/**
 * EAS Observe, when this binary has it. expo-observe loads its native modules on
 * import and throws where they are missing: Expo Go, the web, or a development
 * build made before the package was added.
 */
const observeModule: ObserveModule | null =
  requireOptionalNativeModule('ExpoObserve') && requireOptionalNativeModule('ExpoAppMetrics')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-observe') as ObserveModule)
    : null;

// Lucid is built from this package too, so its binary links the native modules,
// which record launches and crashes on their own. Lucid sends none of it.
if (observeModule && isLucidTrainer) observeModule.Observe.configure({ dispatchingEnabled: false });

const journalObserve = isLucidTrainer ? null : observeModule;

/** Whether this app can send stability reports, so Settings can offer to stop them. */
export function isStabilityReportingAvailable(): boolean {
  return journalObserve !== null;
}

/** Records an error a boundary caught; the global handler never sees those. */
export function reportStabilityError(error: unknown): void {
  journalObserve?.Observe.reportError(error);
}

/** Ends the startup time Observe measures from the native launch. */
export function markStartupInteractive(): void {
  journalObserve?.Observe.markInteractive();
}

/** QA timing events contain only process-local numbers and flags, never dream content/URLs. */
export function recordPerformanceEvent(name: string, attributes: Record<string, number | boolean>): void {
  try {
    journalObserve?.Observe.logEvent(`noctalia.${name}`, { attributes });
  } catch {
    // Diagnostics must never interrupt capture, persistence or rendering.
  }
}

/** Lets Observe mark the first render of the root layout. */
export function wrapObservedRoot<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return journalObserve ? journalObserve.ObserveRoot.wrap(Component) : Component;
}

/** Reports are on unless the person turned them off in Settings. */
export async function getStabilityReportsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STABILITY_REPORTS_KEY)) !== 'off';
}

export async function setStabilityReportsEnabled(enabled: boolean): Promise<void> {
  // Applied before it is saved, so turning reports off holds for this session
  // even if the choice cannot be stored. Observe keeps the setting natively.
  journalObserve?.Observe.configure({ dispatchingEnabled: enabled });
  await AsyncStorage.setItem(STABILITY_REPORTS_KEY, enabled ? 'on' : 'off');
}

/** Reapplies the saved choice at launch; an unreadable choice sends nothing. */
export async function applyStabilityReportsPreference(): Promise<void> {
  if (!journalObserve) return;
  const enabled = await getStabilityReportsEnabled().catch(() => false);
  journalObserve.Observe.configure({ dispatchingEnabled: enabled });
}
