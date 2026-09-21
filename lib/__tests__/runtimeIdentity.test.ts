import { withDevFlag } from '@/tests/setDevFlag';

const mockUpdates = {
  __esModule: true,
  isEnabled: true,
  updateId: '11111111-2222-4333-8444-555555555555' as string | null,
  runtimeVersion: 'runtime-from-running-app' as string | null,
  isEmbeddedLaunch: true,
  isEmergencyLaunch: false,
  channel: 'production',
  manifest: { secret: 'PRIVATE_MANIFEST' },
  emergencyLaunchReason: 'PRIVATE_NATIVE_ERROR',
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
};
const mockApplication = {
  __esModule: true,
  applicationId: 'com.tanuki75.noctalia',
  nativeApplicationVersion: '3.3.0' as string | null,
  nativeBuildVersion: '69' as string | null,
  getAndroidId: jest.fn(),
};
jest.mock('expo-updates', () => mockUpdates);
jest.mock('expo-application', () => mockApplication);

let restoreDev: () => void;
let info: jest.SpyInstance;
let report: () => void;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  restoreDev = withDevFlag(false);
  Object.assign(mockUpdates, {
    isEnabled: true,
    updateId: '11111111-2222-4333-8444-555555555555',
    runtimeVersion: 'runtime-from-running-app',
    isEmbeddedLaunch: true,
    isEmergencyLaunch: false,
  });
  mockApplication.nativeApplicationVersion = '3.3.0';
  mockApplication.nativeBuildVersion = '69';
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
  report = require('../runtimeIdentity').reportRuntimeIdentity;
});

afterEach(() => {
  restoreDev();
  jest.restoreAllMocks();
});

function readIdentity() {
  expect(info).toHaveBeenCalledTimes(1);
  const line = info.mock.calls[0][0] as string;
  expect(line.startsWith('[NoctaliaRuntime] ')).toBe(true);
  return JSON.parse(line.slice('[NoctaliaRuntime] '.length));
}

it.each([true, false])('identifies the executing release, embedded=%s, once per JS runtime', (embedded) => {
  mockUpdates.isEmbeddedLaunch = embedded;
  report();
  report();
  const identity = readIdentity();
  expect(identity).toEqual({
    schemaVersion: 1,
    observedAt: expect.any(String),
    applicationId: 'com.tanuki75.noctalia',
    nativeApplicationVersion: '3.3.0',
    nativeBuildVersion: '69',
    development: false,
    updatesEnabled: true,
    updateId: mockUpdates.updateId,
    runtimeVersion: 'runtime-from-running-app',
    isEmbeddedLaunch: embedded,
    launchSource: embedded ? 'embedded' : 'ota',
    isEmergencyLaunch: false,
    channel: 'production',
  });
  expect(Number.isNaN(Date.parse(identity.observedAt))).toBe(false);
  expect(JSON.stringify(identity)).not.toContain('PRIVATE_');
  expect(mockApplication.getAndroidId).not.toHaveBeenCalled();
  expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
});

it.each(['disabled', 'development', 'missing update', 'missing runtime'])(
  'does not mislabel %s as an OTA launch', (scenario) => {
    mockUpdates.isEmbeddedLaunch = false;
    if (scenario === 'disabled') mockUpdates.isEnabled = false;
    if (scenario === 'development') withDevFlag(true);
    if (scenario === 'missing update') mockUpdates.updateId = null;
    if (scenario === 'missing runtime') mockUpdates.runtimeVersion = '';
    report();
    expect(readIdentity().launchSource).toBe('unknown');
  }
);

it('retains emergency fallback evidence without exposing its error', () => {
  mockUpdates.isEmergencyLaunch = true;
  report();
  expect(readIdentity()).toMatchObject({ isEmergencyLaunch: true, launchSource: 'embedded' });
});

it('does not substitute manifest versions for unavailable native versions', () => {
  mockApplication.nativeApplicationVersion = null;
  mockApplication.nativeBuildVersion = null;
  report();
  expect(readIdentity()).toMatchObject({ nativeApplicationVersion: null, nativeBuildVersion: null });
});

it('does not interrupt startup when logging is unavailable', () => {
  info.mockImplementation(() => { throw new Error('PRIVATE_LOG_ERROR'); });
  expect(report).not.toThrow();
});
