import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { DEFAULT_SCHEDULE } from '@/lib/reminders';
import { StorageKey } from '@/services/storageService';

const mountSettings = async () => {
  const view = renderHook(() => useSettings(), { wrapper: SettingsProvider });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
};

describe('SettingsProvider', () => {
  it('starts from the defaults', async () => {
    const { result } = await mountSettings();

    expect(result.current.profile).toEqual({ displayName: '', avatarUri: null });
    expect(result.current.reminders).toEqual(DEFAULT_SCHEDULE);
  });

  it('persists the profile', async () => {
    const { result } = await mountSettings();

    await act(async () => {
      await result.current.setProfile({ displayName: 'Camille' });
    });

    const raw = await AsyncStorage.getItem(StorageKey.profile);
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ displayName: 'Camille' });
  });

  it('keeps the avatar when only the name changes', async () => {
    const { result } = await mountSettings();

    await act(async () => {
      await result.current.setProfile({ avatarUri: 'file:///photo.jpg' });
    });
    await act(async () => {
      await result.current.setProfile({ displayName: 'Camille' });
    });

    expect(result.current.profile).toEqual({
      displayName: 'Camille',
      avatarUri: 'file:///photo.jpg',
    });
  });

  it('keeps both of two edits dispatched in the same tick', async () => {
    // Same regression class as the other providers: a stale read would drop one.
    const { result } = await mountSettings();

    await act(async () => {
      result.current.setReminders({ hour: 22 });
      result.current.setReminders({ days: [1, 3, 5] });
    });

    expect(result.current.reminders).toMatchObject({ hour: 22, days: [1, 3, 5] });
  });

  it('restores a schedule written by an older build, filling what is missing', async () => {
    await AsyncStorage.setItem(
      StorageKey.reminders,
      JSON.stringify({ enabled: true, hour: 8, minute: 0 })
    );

    const { result } = await mountSettings();

    expect(result.current.reminders).toMatchObject({ enabled: true, hour: 8, days: [] });
  });
});
