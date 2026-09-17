import { decodeCaptureDraft, encodeCaptureReview } from '../captureReviewDraft';

it('round-trips an edited proposal and exact original including uncertainty and line breaks', () => {
  const review = { source: 'Une plage.\nQuestion : Sa couleur ?\nRéponse : noire, je crois.', text: 'Une plage noire, je crois.' };
  expect(decodeCaptureDraft(encodeCaptureReview(review))).toEqual({ transcript: review.source, review });
});
it('keeps legacy and malformed drafts intact', () => {
  for (const value of ['An old draft', 'NOCTALIA_CAPTURE_REVIEW_V1\n{broken']) {
    expect(decodeCaptureDraft(value)).toEqual({ transcript: value, review: null });
  }
});
