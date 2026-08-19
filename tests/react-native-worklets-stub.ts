/**
 * Jest stub for `react-native-worklets`.
 *
 * Worklets need the UI runtime, which does not exist under test. Scheduling back to the
 * RN runtime is therefore a direct call: `scheduleOnRN(fn, ...args)` runs `fn` inline, so
 * animation completion callbacks still fire and their effects stay assertable.
 */
export const scheduleOnRN = <TArgs extends unknown[]>(fn: (...args: TArgs) => unknown, ...args: TArgs) =>
  fn(...args);

export const scheduleOnUI = (fn: () => unknown) => fn();
export const runOnJS = <TArgs extends unknown[]>(fn: (...args: TArgs) => unknown) => fn;
export const runOnUI = <TArgs extends unknown[]>(fn: (...args: TArgs) => unknown) => fn;
export const runOnUISync = <TArgs extends unknown[]>(fn: (...args: TArgs) => unknown) => fn;
export const executeOnUIRuntimeSync = <TArgs extends unknown[]>(fn: (...args: TArgs) => unknown) => fn;
