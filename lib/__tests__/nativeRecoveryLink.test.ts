import { parseNativeRecoveryLink } from '../nativeRecoveryLink';

describe('native recovery links', () => {
  it('accepts only one recovery token hash', () => {
    expect(parseNativeRecoveryLink({ token_hash: 'one-use-hash', type: 'recovery' }))
      .toEqual({ state: 'pending', tokenHash: 'one-use-hash' });
  });

  it('rejects bearer sessions, mixed links, duplicate values and other OTP purposes', () => {
    for (const params of [
      { access_token: 'borrowed', refresh_token: 'refresh', type: 'recovery' },
      { token_hash: 'hash', type: 'recovery', access_token: 'borrowed' },
      { token_hash: ['hash', 'hash'], type: 'recovery' },
      { token_hash: 'hash', type: ['recovery', 'recovery'] },
      { token_hash: 'hash', type: 'signup' },
    ]) {
      expect(parseNativeRecoveryLink(params)).toEqual({ state: 'invalid' });
    }
    expect(parseNativeRecoveryLink({ source: 'settings' })).toEqual({ state: 'none' });
  });
});
