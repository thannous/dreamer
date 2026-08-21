import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/notificationServiceMock';
import * as real from './notificationServiceReal';

/** Conditional export, resolved at bundle time — the Noctalia convention. */
const implementation = isMockModeEnabled() ? mock : real;

export const requestPermission = implementation.requestPermission;
export const cancelAll = implementation.cancelAll;
export const syncReminders = implementation.syncReminders;
