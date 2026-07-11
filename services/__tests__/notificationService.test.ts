import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockService,
  mockRealService,
  mockNotifications,
} = ((factory: any) => factory())(() => {
  let mockMode = false;
  const buildService = () => ({
    configureNotificationHandler: jest.fn(),
    requestNotificationPermissions: jest.fn(),
    scheduleDailyNotification: jest.fn(),
    scheduleRitualReminder: jest.fn(),
    cancelAllNotifications: jest.fn(),
    getScheduledNotifications: jest.fn(),
    hasNotificationPermissions: jest.fn(),
    sendTestNotification: jest.fn(),
  });

  return {
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockService: buildService(),
    mockRealService: buildService(),
    mockNotifications: {
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      setNotificationChannelAsync: jest.fn(),
      AndroidImportance: { HIGH: 4 },
      IosAuthorizationStatus: {
        AUTHORIZED: 2,
        PROVISIONAL: 3,
        EPHEMERAL: 4,
      },
    },
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('../mocks/notificationServiceMock', () => mockService);
jest.mock('../notificationServiceReal', () => mockRealService);
jest.mock('expo-notifications', () => mockNotifications);
jest.mock('@/lib/i18n', () => ({
  getTranslator: () => (key: string) => key,
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSetMockMode(false);
  });

  it('given mock mode__when scheduling notification__then uses mock implementation', async () => {
    mockSetMockMode(true);

    const service = require('../notificationService');
    await service.scheduleDailyNotification({
      weekdayEnabled: true,
      weekendEnabled: false,
      weekdayTime: '07:30',
      weekendTime: '09:00',
    });

    expect(mockService.scheduleDailyNotification).toHaveBeenCalled();
    expect(mockRealService.scheduleDailyNotification).not.toHaveBeenCalled();
  });

  it('given real mode__when checking permissions__then uses real implementation', async () => {
    mockSetMockMode(false);

    const service = require('../notificationService');
    await service.hasNotificationPermissions();

    expect(mockRealService.hasNotificationPermissions).toHaveBeenCalled();
    expect(mockService.hasNotificationPermissions).not.toHaveBeenCalled();
  });
});

describe('notificationServiceReal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Platform } = require('react-native');
    Platform.OS = 'android';

    mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
    });
  });

  afterEach(() => {
    const { Platform } = require('react-native');
    Platform.OS = 'web';
  });

  it('creates the Android channel before checking and requesting permissions', async () => {
    const calls: string[] = [];
    mockNotifications.setNotificationChannelAsync.mockImplementation(async () => {
      calls.push('channel');
      return null;
    });
    mockNotifications.getPermissionsAsync.mockImplementation(async () => {
      calls.push('getPermissions');
      return { granted: false, status: 'denied' };
    });
    mockNotifications.requestPermissionsAsync.mockImplementation(async () => {
      calls.push('requestPermissions');
      return { granted: true, status: 'granted' };
    });

    const realService = jest.requireActual(
      '../notificationServiceReal'
    ) as typeof import('../notificationServiceReal');

    await expect(realService.requestNotificationPermissions()).resolves.toBe(true);

    expect(calls).toEqual(['channel', 'getPermissions', 'requestPermissions']);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'dream-reminders',
      {
        name: 'notifications.channel_name',
        importance: 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      }
    );
  });
});
