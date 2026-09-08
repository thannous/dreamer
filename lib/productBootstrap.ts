export type StartupProduct = 'journal' | 'lucid';
type BootstrapAction = 'guestSession' | 'googleSignIn' | 'guestAnalysisMigration' | 'guestDreamMigration';
type BootstrapDependencies = Record<BootstrapAction, () => Promise<unknown> | void>;
type ReportFailure = (action: BootstrapAction, error: unknown) => void;
type Schedule = (callback: () => void) => { cancel: () => void };

// Module loading is inside each action: selecting Lucid never loads guest services.
const defaultDependencies: BootstrapDependencies = {
  guestSession: () => import('@/lib/guestSession').then(({ initGuestSession }) => initGuestSession()),
  googleSignIn: () => import('@/lib/auth').then(({ initializeGoogleSignIn }) => initializeGoogleSignIn()),
  guestAnalysisMigration: () => import('@/services/quota/GuestAnalysisCounter').then(
    ({ migrateExistingGuestQuota }) => migrateExistingGuestQuota()
  ),
  guestDreamMigration: () => import('@/services/quota/GuestDreamCounter').then(
    ({ migrateExistingGuestDreamRecording }) => migrateExistingGuestDreamRecording()
  ),
};

/** Run independent post-route work; a failed action must not suppress another. */
export async function runProductBootstrap(
  product: StartupProduct,
  reportFailure: ReportFailure,
  dependencies: BootstrapDependencies = defaultDependencies
): Promise<void> {
  const actions: BootstrapAction[] = product === 'journal'
    ? ['guestSession', 'googleSignIn', 'guestAnalysisMigration', 'guestDreamMigration']
    : ['googleSignIn'];

  await Promise.all(actions.map(async (action) => {
    try {
      await dependencies[action]();
    } catch (error) {
      reportFailure(action, error);
    }
  }));
}

/** Cleanup cancels queued work, but does not abort actions already started. */
export function scheduleProductBootstrap(
  product: StartupProduct,
  schedule: Schedule,
  reportFailure: ReportFailure,
  dependencies: BootstrapDependencies = defaultDependencies
): () => void {
  const task = schedule(() => {
    void runProductBootstrap(product, reportFailure, dependencies);
  });
  return () => task.cancel();
}
