import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const { mockGetMockMode, mockSetMockMode, mockService, mockRealService } = ((factory: any) => factory())(() => {
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
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('../mocks/notificationServiceMock', () => mockService);
jest.mock('../notificationServiceReal', () => mockRealService);

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
