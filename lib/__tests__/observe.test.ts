import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock('expo-observe', () => ({
  Observe: { configure: jest.fn(), reportError: jest.fn(), markInteractive: jest.fn(), logEvent: jest.fn() },
  ObserveRoot: { wrap: jest.fn((Component: unknown) => Component) },
}));

type ObserveLib = typeof import('@/lib/observe');
type ObserveMock = { configure: jest.Mock; reportError: jest.Mock; logEvent: jest.Mock };

// Observe runs only in a native build, so no E2E journey can see what it is told.
// These cases pin the opt-out promised in the privacy policy, and Lucid's silence.
function load(variant: 'journal' | 'lucid'): { lib: ObserveLib; observe: ObserveMock } {
  let lib!: ObserveLib;
  let observe!: ObserveMock;
  jest.isolateModules(() => {
    jest.doMock('@/lib/appVariant', () => ({ isLucidTrainer: variant === 'lucid' }));
    lib = require('@/lib/observe');
    observe = (require('expo-observe') as { Observe: ObserveMock }).Observe;
  });
  return { lib, observe };
}

describe('stability reports', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps a turned-off choice across launches', async () => {
    const first = load('journal');
    await first.lib.setStabilityReportsEnabled(false);
    expect(first.observe.configure).toHaveBeenLastCalledWith({ dispatchingEnabled: false });

    const next = load('journal');
    await next.lib.applyStabilityReportsPreference();
    expect(next.observe.configure).toHaveBeenLastCalledWith({ dispatchingEnabled: false });
  });

  it('stops sending for the session even when the choice cannot be stored', async () => {
    const { lib, observe } = load('journal');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(lib.setStabilityReportsEnabled(false)).rejects.toThrow('disk full');
    expect(observe.configure).toHaveBeenLastCalledWith({ dispatchingEnabled: false });
  });

  it('sends nothing from Lucid and offers no switch there', () => {
    const { lib, observe } = load('lucid');
    expect(observe.configure).toHaveBeenCalledWith({ dispatchingEnabled: false });
    lib.reportStabilityError(new Error('boom'));
    lib.recordPerformanceEvent('analysis.text_committed', { trace: 1 });
    expect(observe.reportError).not.toHaveBeenCalled();
    expect(observe.logEvent).not.toHaveBeenCalled();
    expect(lib.isStabilityReportingAvailable()).toBe(false);
  });

  it('keeps a native telemetry failure out of the capture path', () => {
    const { lib, observe } = load('journal');
    observe.logEvent.mockImplementationOnce(() => { throw new Error('metrics unavailable'); });
    expect(() => lib.recordPerformanceEvent('journal.save_acknowledged', { trace: 1 })).not.toThrow();
  });
});
