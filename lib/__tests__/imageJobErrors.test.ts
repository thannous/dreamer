import { classifyError, ErrorType } from '../errors';

it.each(['FREE_IMAGE_ANALYSIS_REQUIRED', 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING', 'HD_IMAGE_PLUS_REQUIRED'])(
  'classifies %s as a rights issue rather than a transient client error', code => {
    const error = Object.assign(new Error('HTTP 402'), { status: 402, body: { code } });
    const classified = classifyError(error);
    expect(classified.type).toBe(ErrorType.IMAGE_AUTHORIZATION);
    expect(classified.canRetry).toBe(false);
    expect(classified.userMessage).toContain('saved');
  }
);

it('does not infer subscription expiry from a transient authorization service outage', () => {
  const error = Object.assign(new Error('HTTP 503'), { status: 503, body: { code: 'FREE_IMAGE_ANALYSIS_CLAIM_UNAVAILABLE' } });
  expect(classifyError(error).canRetry).toBe(true);
  expect(classifyError(error).type).toBe(ErrorType.SERVER);
});

it('disables retry for an exhausted server request', () => {
  const error = Object.assign(new Error('HTTP 409'), { status: 409, body: { code: 'AI_JOB_ATTEMPTS_EXHAUSTED' } });
  expect(classifyError(error).canRetry).toBe(false);
  expect(classifyError(error).type).toBe(ErrorType.IMAGE_EXHAUSTED);
});
