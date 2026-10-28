/**
 * Runs operations one after another: each starts once the previous one has
 * settled, whatever its outcome. Every call creates an independent queue; an
 * operation that waits on its own queue deadlocks.
 */
export function createSerialLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
