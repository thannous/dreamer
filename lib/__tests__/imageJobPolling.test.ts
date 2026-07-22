import { getImageJobPollDelay, IMAGE_JOB_POLL_DELAYS_MS } from '../imageJobPolling';

describe('getImageJobPollDelay', () => {
  it('backs off from two seconds to a fifteen-second ceiling', () => {
    expect([0, 1, 2, 3, 4, 20].map(getImageJobPollDelay)).toEqual([
      2000,
      4000,
      8000,
      15000,
      15000,
      15000,
    ]);
    expect(IMAGE_JOB_POLL_DELAYS_MS).toEqual([2000, 4000, 8000, 15000]);
  });

  it('normalizes invalid attempts to the initial delay', () => {
    expect(getImageJobPollDelay(-3)).toBe(2000);
    expect(getImageJobPollDelay(Number.NaN)).toBe(2000);
  });
});
