import { areAccountsEnabled, isMockModeEnabled } from '@/lib/env';

/** Written out in full, like the app itself: dynamic access is forbidden. */
const setAccountsEnv = (value: string | undefined) => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_ACCOUNTS_ENABLED;
  else process.env.EXPO_PUBLIC_ACCOUNTS_ENABLED = value;
};

const setMockEnv = (value: string | undefined) => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_MOCK_MODE;
  else process.env.EXPO_PUBLIC_MOCK_MODE = value;
};

describe('areAccountsEnabled', () => {
  const original = process.env.EXPO_PUBLIC_ACCOUNTS_ENABLED;

  afterEach(() => setAccountsEnv(original));

  it('is false when the variable is unset', () => {
    setAccountsEnv(undefined);

    expect(areAccountsEnabled()).toBe(false);
  });

  it.each(['true', '1'])('is true for %p', (value) => {
    setAccountsEnv(value);

    expect(areAccountsEnabled()).toBe(true);
  });

  // A sign-in button that leads nowhere is an App Store 2.1 rejection: anything
  // that is not exactly 'true' or '1' keeps the auth screens unreachable.
  it.each(['', 'false', '0', 'TRUE', 'True', ' true', 'true ', 'yes', 'on', '2', 'null'])(
    'is false for %p',
    (value) => {
      setAccountsEnv(value);

      expect(areAccountsEnabled()).toBe(false);
    }
  );
});

describe('isMockModeEnabled', () => {
  const original = process.env.EXPO_PUBLIC_MOCK_MODE;

  afterEach(() => setMockEnv(original));

  it('reads the same strict opt-in as accounts', () => {
    setMockEnv(undefined);
    expect(isMockModeEnabled()).toBe(false);

    setMockEnv('false');
    expect(isMockModeEnabled()).toBe(false);

    setMockEnv('true');
    expect(isMockModeEnabled()).toBe(true);

    setMockEnv('1');
    expect(isMockModeEnabled()).toBe(true);
  });
});
