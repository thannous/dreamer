import {
  isLucidDateKey,
  isLucidLocalTime,
  isLucidSyncMutation,
  isLucidTimeZone,
  isLucidTrainerState,
  parseLucidSyncQueue,
  parseLucidTrainerState,
} from '@/lib/lucid/model';
import { createInitialLucidTrainerState } from '@/lib/lucid/domain';

describe('Lucid Trainer model', () => {
  const NOW = 1_700_000_000_000;

  it('creates a valid state with cloud and Noctalia transfer disabled by default', () => {
    const state = createInitialLucidTrainerState({
      now: NOW,
      timeZone: 'Europe/Paris',
      locale: 'fr',
    });

    expect(isLucidTrainerState(state)).toBe(true);
    expect(state.preferences).toMatchObject({
      theme: 'dynamic',
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
      audioCuesEnabled: false,
      notificationsEnabled: false,
    });
    expect(parseLucidTrainerState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ['future schema', (state: any) => (state.schemaVersion = 2)],
    ['missing explicit cloud opt-in', (state: any) => delete state.preferences.cloudSyncEnabled],
    ['unsafe audio volume', (state: any) => (state.preferences.audioVolume = 0.8)],
    [
      'invalid sleep quality',
      (state: any) => {
        state.experiments = [
          {
            id: 'exp-1',
            occurredAt: NOW,
            technique: 'mild',
            preparationMinutes: 10,
            result: 'lucid',
            lucidityLevel: 4,
            recallLevel: 5,
            sleepQuality: 6,
            factors: [],
            updatedAt: NOW,
          },
        ];
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const state: any = createInitialLucidTrainerState({
      now: NOW,
      timeZone: 'UTC',
    });
    mutate(state);

    expect(isLucidTrainerState(state)).toBe(false);
    expect(parseLucidTrainerState(JSON.stringify(state))).toBeNull();
  });

  it('validates local times and real calendar dates', () => {
    expect(isLucidLocalTime('23:59')).toBe(true);
    expect(isLucidLocalTime('24:00')).toBe(false);
    expect(isLucidLocalTime('7:00')).toBe(false);
    expect(isLucidDateKey('2028-02-29')).toBe(true);
    expect(isLucidDateKey('2027-02-29')).toBe(false);
    expect(isLucidTimeZone('Europe/Paris')).toBe(true);
    expect(isLucidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('validates entity identity and idempotent mutation fields', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const mutation = {
      version: 1,
      id: 'mutation-1',
      userScope: 'user:user-1',
      entityType: 'preferences',
      entityKey: 'preferences',
      operation: 'upsert',
      clientRequestId: 'request-1',
      clientUpdatedAt: NOW,
      payload: {
        entity: {
          entityType: 'preferences',
          entityKey: 'preferences',
          value: state.preferences,
        },
      },
      status: 'pending',
      retryCount: 0,
      createdAt: NOW,
    };

    expect(isLucidSyncMutation(mutation)).toBe(true);
    expect(
      isLucidSyncMutation({
        ...mutation,
        entityKey: 'another-key',
      })
    ).toBe(false);
    expect(parseLucidSyncQueue(JSON.stringify([mutation]))).toEqual([mutation]);
    expect(parseLucidSyncQueue('{bad-json')).toBeNull();
  });
});
