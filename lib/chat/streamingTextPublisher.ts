/** Bound Markdown updates without delaying the first fragment or the final message. */
export function createStreamingTextPublisher(publish: (text: string) => void, intervalMs = 50) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;
  let lastPublished: string | undefined;
  let lastPublishedAt = -Infinity;
  let disposed = false;

  const flush = (text = pending) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
    if (disposed || text === undefined || text === lastPublished) return;
    lastPublished = text;
    lastPublishedAt = Date.now();
    publish(text);
  };

  return {
    push(text: string) {
      if (disposed) return;
      pending = text;
      const remaining = intervalMs - (Date.now() - lastPublishedAt);
      if (remaining <= 0) flush();
      else if (timer === undefined) timer = setTimeout(() => flush(), remaining);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}
