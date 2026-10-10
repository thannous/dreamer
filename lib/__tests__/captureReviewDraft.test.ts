import { buildCaptureNarrative, decodeCaptureDraft, encodeCaptureReview } from '../captureReviewDraft';

it('round-trips an edited proposal and exact original including uncertainty and line breaks', () => {
  const review = { source: 'Une plage.\nQuestion : Sa couleur ?\nRéponse : noire, je crois.', text: 'Une plage noire, je crois.' };
  expect(decodeCaptureDraft(encodeCaptureReview(review))).toEqual({ transcript: review.source, review });
});
it('remembers through a reload that the proposal was woven by the formatter', () => {
  const review = { source: 'Une plage.\n\nQuestion : Sa couleur ?\nRéponse : noire.', text: 'Une plage noire.', woven: true };
  expect(decodeCaptureDraft(encodeCaptureReview(review)).review).toEqual(review);
});
it('keeps legacy and malformed drafts intact', () => {
  for (const value of ['An old draft', 'NOCTALIA_CAPTURE_REVIEW_V1\n{broken']) {
    expect(decodeCaptureDraft(value)).toEqual({ transcript: value, review: null });
  }
});

it('keeps only narrator words in the review, with questions preserved in the source', () => {
  const source = 'Un nuage.\n\nQuestion : Où allais-tu ?\nRéponse : Dans un château.\n\nQuestion : Comment était-il ?\nRéponse : Grand, je crois.';
  const text = 'Un nuage.\n\nDans un château.\n\nGrand, je crois.';
  expect(buildCaptureNarrative(source)).toBe(text);
  expect(decodeCaptureDraft(encodeCaptureReview({ source, text: source }))).toEqual({ transcript: source, review: { source, text } });
  const edited = 'Mon récit modifié.\nQuestion : une phrase que je souhaite garder ?';
  expect(decodeCaptureDraft(encodeCaptureReview({ source, text: edited })).review?.text).toBe(edited);
});
