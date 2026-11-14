type AttemptHandlers<T> = {
  /** Answers in place of a `task` that threw. Without it the error goes on to the caller. */
  catch?: (error: unknown) => T | Promise<T>;
  /** Runs last, whether `task` returned or threw. */
  finally?: () => void;
};

/**
 * A `try` statement for functions written inside a component or a hook.
 *
 * React Compiler leaves a whole component unoptimized as soon as one function in its body
 * holds a `finally`, a `throw` inside `try`, or a condition (`?:`, `&&`, `?.`) inside
 * `try`/`catch`: the screen then renders again in full on every state change. The same
 * control flow, held here, is compiled. `task` returns where the `try` block returned.
 *
 * Always asynchronous: `finally` runs one or two microtasks later than a `finally` block
 * would, still before any other event (a tap, a timer, a native callback) is handled.
 */
export async function attempt<T>(
  task: () => T | Promise<T>,
  handlers: AttemptHandlers<T>
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (!handlers.catch) throw error;
    return await handlers.catch(error);
  } finally {
    handlers.finally?.();
  }
}

/**
 * Runs `task` with `flag` up, and lowers it when the task ends, however it ends. The caller
 * checks the flag first: a second gesture arriving meanwhile finds it up and leaves.
 */
export function whileHeld<T>(flag: { current: boolean }, task: () => T | Promise<T>): Promise<T> {
  flag.current = true;
  return attempt(task, { finally: () => { flag.current = false; } });
}
