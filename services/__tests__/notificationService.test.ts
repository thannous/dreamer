import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMockMode, setMockMode, mockService, realService } = vi.hoisted(() => {
  let mockMode = false;
  const buildService = () => ({
    configureNotificationHandler: vi.fn(),
    requestNotificationPermissions: vi.fn(),
    scheduleDailyNotification: vi.fn(),
    scheduleRitualReminder: vi.fn(),
    cancelAllNotifications: vi.fn(),
    getScheduledNotifications: vi.fn(),
    hasNotificationPermissions: vi.fn(),
    sendTestNotification: vi.fn(),
  });

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockService: buildService(),
    realService: buildService(),
  };
});

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('../mocks/notificationServiceMock', () => mockService);
vi.mock('../notificationServiceReal', () => realService);

describe('notificationService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setMockMode(false);
  });

  it('given mock mode__when scheduling notification__then uses mock implementation', async () => {
    setMockMode(true);

    const service = await import('../notificationService');
    await service.scheduleDailyNotification({
      weekdayEnabled: true,
      weekendEnabled: false,
      weekdayTime: '07:30',
      weekendTime: '09:00',
    });

    expect(mockService.scheduleDailyNotification).toHaveBeenCalled();
    expect(realService.scheduleDailyNotification).not.toHaveBeenCalled();
  });

  it('given real mode__when checking permissions__then uses real implementation', async () => {
    setMockMode(false);

    const service = await import('../notificationService');
    await service.hasNotificationPermissions();

    expect(realService.hasNotificationPermissions).toHaveBeenCalled();
    expect(mockService.hasNotificationPermissions).not.toHaveBeenCalled();
  });
});
