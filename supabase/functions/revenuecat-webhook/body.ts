// RevenueCat events are a few KiB; the cap only bounds what an authenticated sender can stream.
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export type LimitedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_large' | 'unreadable' };

/**
 * Reads the body without buffering more than `maxBytes`, whether or not the
 * sender declared a Content-Length. Stops the stream as soon as the cap is crossed.
 */
export async function readLimitedBody(req: Request, maxBytes = MAX_WEBHOOK_BODY_BYTES): Promise<LimitedBodyResult> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' };
  if (!req.body) return { ok: true, text: '' };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
