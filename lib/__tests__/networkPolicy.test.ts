import { NETWORK_REQUEST_POLICIES } from '../networkPolicy';

describe('NETWORK_REQUEST_POLICIES', () => {
  it('never automatically retries non-durable paid AI calls', () => {
    expect(NETWORK_REQUEST_POLICIES.analyzeDream.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.analyzeDreamFull.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.categorizeDream.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.chat.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.generateImage.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.generateImageWithReference.retries).toBe(0);
    expect(NETWORK_REQUEST_POLICIES.transcribeAudio.retries).toBe(0);
  });

  it('allows conservative retries only for idempotent job commands and reads', () => {
    expect(NETWORK_REQUEST_POLICIES.analysisJobCommand.retries).toBe(1);
    expect(NETWORK_REQUEST_POLICIES.analysisJobStatus.retries).toBe(1);
    expect(NETWORK_REQUEST_POLICIES.imageJobCommand.retries).toBe(1);
    expect(NETWORK_REQUEST_POLICIES.imageJobStatus.retries).toBe(1);
  });
});
