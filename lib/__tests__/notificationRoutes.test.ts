import { isSafeAppNotificationRoute } from '@/lib/notificationRoutes';

describe('notificationRoutes', () => {
  it('only accepts the allowlisted in-app routes', () => {
    expect(isSafeAppNotificationRoute('/weekly-recap')).toBe(true);
    expect(isSafeAppNotificationRoute('/journal/42')).toBe(true);
    expect(isSafeAppNotificationRoute('/recording')).toBe(false);
    expect(isSafeAppNotificationRoute('/journal/[id]')).toBe(false);
    expect(isSafeAppNotificationRoute('/settings')).toBe(false);
    expect(isSafeAppNotificationRoute('https://evil.example/weekly-recap')).toBe(false);
    expect(isSafeAppNotificationRoute(undefined)).toBe(false);
    expect(isSafeAppNotificationRoute({ url: '/weekly-recap' })).toBe(false);
  });
});
