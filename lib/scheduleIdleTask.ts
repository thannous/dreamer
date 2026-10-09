/** Schedule cancellable background work once the runtime has idle time. */
export function scheduleIdleTask(callback: () => void): { cancel: () => void } {
  // Safari and older embedded browsers may not implement the idle callback API.
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback);
    return { cancel: () => cancelIdleCallback(handle) };
  }
  const handle = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(handle) };
}
