export function withDevFlag(value: boolean): () => void {
  const target = globalThis as unknown as { __DEV__: boolean };
  const previous = target.__DEV__;
  target.__DEV__ = value;
  return () => {
    target.__DEV__ = previous;
  };
}
