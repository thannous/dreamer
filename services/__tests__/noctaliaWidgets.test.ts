import { Platform } from 'react-native';

// A development build made before expo-widgets has no native module: requiring the
// package there throws, and the dev build follows master. Nothing may load it then.
// Where the module is there, one countdown is started, then only moved on, and every
// countdown on the lock screen is ended, a crashed launch's included.

const mockRequireOptionalNativeModule = jest.fn();
jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => mockRequireOptionalNativeModule(name),
}));
// Each factory runs only when its module is required: it records the load.
const mockLoaded = jest.fn();
jest.mock('expo-widgets', () => {
  mockLoaded('expo-widgets');
  return { widgetsDirectory: 'file:///group/widgets' };
});
const mockCreateURL = jest.fn((path: string, _options?: { queryParams?: Record<string, string> }) => `noctalia://${path}`);
jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) => mockCreateURL(path, options),
}));

const mockActivity = (id: string) => ({
  getId: () => id,
  update: jest.fn().mockResolvedValue(undefined),
  end: jest.fn().mockResolvedValue(undefined),
});
const mockFactory = { start: jest.fn(), getInstances: jest.fn() };
jest.mock('@/widgets/DreamCaptureWidget', () => {
  mockLoaded('DreamCaptureWidget');
  return { default: { updateSnapshot: jest.fn() } };
});
jest.mock('@/widgets/LastDreamWidget', () => {
  mockLoaded('LastDreamWidget');
  return { default: { updateSnapshot: jest.fn() } };
});
jest.mock('@/widgets/SleepTimerActivity', () => {
  mockLoaded('SleepTimerActivity');
  return { default: mockFactory };
});

type Service = typeof import('../noctaliaWidgets');
const load = (): Service => {
  let service: Service | undefined;
  jest.isolateModules(() => {
    service = require('../noctaliaWidgets');
  });
  return service!;
};
const session = { sound: 'Gentle rain', caption: 'Fades out in', remainingMs: 15 * 60_000, paused: false };

describe('noctaliaWidgets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('leaves a build without the widgets module alone', () => {
    mockRequireOptionalNativeModule.mockReturnValue(null);
    const service = load();

    expect(service.getNoctaliaWidgets()).toBeNull();
    service.showSleepTimer(session);
    service.endSleepTimer();
    service.updateCaptureWidget('Tell my dream');

    expect(mockLoaded).not.toHaveBeenCalled();
    expect(mockFactory.start).not.toHaveBeenCalled();
    expect(mockFactory.getInstances).not.toHaveBeenCalled();
  });

  it('starts one countdown, moves it on, then ends it with any left by an earlier launch', () => {
    mockRequireOptionalNativeModule.mockReturnValue({});
    const own = mockActivity('own');
    const leftover = mockActivity('leftover');
    mockFactory.start.mockReturnValue(own);
    mockFactory.getInstances.mockReturnValue([own, leftover]);
    const service = load();

    service.showSleepTimer(session);
    service.showSleepTimer({ ...session, caption: 'Paused', remainingMs: 60_000, paused: true });

    expect(mockLoaded).toHaveBeenCalledWith('expo-widgets');
    expect(mockFactory.start).toHaveBeenCalledTimes(1);
    expect(mockFactory.start.mock.calls[0][1]).toBe('noctalia://sleep-sounds');
    expect(own.update).toHaveBeenCalledWith(
      expect.objectContaining({ caption: 'Paused', paused: true, to: expect.any(Number) }),
      expect.any(Date),
    );
    const [{ from, to }, staleDate] = own.update.mock.calls[0] as [{ from: number; to: number }, Date];
    expect(to - from).toBe(60_000);
    // A paused countdown left behind turns stale too, a minute after it would have ended.
    expect(staleDate.getTime()).toBe(to + 60_000);

    service.endSleepTimer();

    expect(own.end).toHaveBeenCalledTimes(1);
    expect(leftover.end).toHaveBeenCalledWith('immediate');
  });

  it('hands the dream identity to the app link, as the journal reads it', () => {
    mockRequireOptionalNativeModule.mockReturnValue({});
    const service = load();

    service.appLink('journal/10', { remoteId: '42' });

    expect(mockCreateURL).toHaveBeenCalledWith('journal/10', { queryParams: { remoteId: '42' } });
  });
});
