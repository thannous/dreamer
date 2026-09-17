export type ImageJobFailure = {
  titleKey: string;
  messageKey: string;
  action: 'subscription' | 'none';
};

/** Only terminal jobs use this mapping: PENDING is a legacy exhausted-worker code. */
export function getImageJobFailure(code?: string | null): ImageJobFailure | null {
  if (code === 'FREE_IMAGE_ANALYSIS_REQUIRED' || code === 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING'
    || code === 'HD_IMAGE_PLUS_REQUIRED') {
    return {
      titleKey: 'image_retry.authorization_title',
      messageKey: 'image_retry.authorization_message',
      action: 'subscription',
    };
  }
  if (code === 'AI_JOB_ATTEMPTS_EXHAUSTED') {
    return {
      titleKey: 'image_retry.exhausted_title',
      messageKey: 'image_retry.exhausted_message',
      action: 'none',
    };
  }
  return null;
}
