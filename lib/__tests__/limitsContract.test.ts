import { QUOTAS } from '@/constants/limits';

describe('interpretation and chat safety limits', () => {
  it('does not expose exploration as a separate entitlement', () => {
    expect(QUOTAS.guest.exploration).toBeNull();
    expect(QUOTAS.free.exploration).toBeNull();
    expect(QUOTAS.plus.exploration).toBeNull();
  });

  it('matches the server chat safety limits per interpreted dream', () => {
    expect(QUOTAS.guest.messagesPerDream).toBe(10);
    expect(QUOTAS.free.messagesPerDream).toBe(10);
    expect(QUOTAS.plus.messagesPerDream).toBe(20);
  });
});
