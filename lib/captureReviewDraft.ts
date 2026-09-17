export type CaptureReview = { source: string; text: string };
const PREFIX = 'NOCTALIA_CAPTURE_REVIEW_V1\n';

/** One durable draft record keeps the source and edited proposal together. Legacy plain drafts still work. */
export function encodeCaptureReview(review: CaptureReview): string {
  return PREFIX + JSON.stringify(review);
}

export function decodeCaptureDraft(value: string): { transcript: string; review: CaptureReview | null } {
  if (value.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length));
      if (typeof parsed?.source === 'string' && typeof parsed?.text === 'string') {
        return { transcript: parsed.source, review: { source: parsed.source, text: parsed.text } };
      }
    } catch { /* Preserve unrecognized text; never erase a draft. */ }
  }
  return { transcript: value, review: null };
}
