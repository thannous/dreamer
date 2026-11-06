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

/** Each instance owns independent queues; different keys can run concurrently. */
export function createKeyedSerialLock<Key = string>() {
  const tails = new Map<Key, Promise<void>>();

  async function run<T>(key: Key, operation: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    tails.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(key) === tail) tails.delete(key);
    }
  }

  return { run, countKeys: () => tails.size };
}
