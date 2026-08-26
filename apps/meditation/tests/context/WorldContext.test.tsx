import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DEFAULT_WORLD_ID, WORLD_BY_ID } from '@/constants/worlds';
import { WorldProvider, useWorld } from '@/context/WorldContext';
import { StorageKey } from '@/services/storageService';

const mountWorld = async () => {
  const view = renderHook(() => useWorld(), { wrapper: WorldProvider });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
};

describe('WorldProvider', () => {
  it('starts in the default world on a new device', async () => {
    const { result } = await mountWorld();

    expect(result.current.worldId).toBe(DEFAULT_WORLD_ID);
    expect(result.current.world).toBe(WORLD_BY_ID[DEFAULT_WORLD_ID]);
    expect(result.current.previewWorldId).toBeNull();
    expect(result.current.presentationWorldId).toBe(DEFAULT_WORLD_ID);
    expect(result.current.presentationWorld).toBe(WORLD_BY_ID[DEFAULT_WORLD_ID]);
  });

  it('restores a previously selected world', async () => {
    await AsyncStorage.setItem(StorageKey.world, JSON.stringify('dawn'));

    const { result } = await mountWorld();

    expect(result.current.worldId).toBe('dawn');
    expect(result.current.world).toBe(WORLD_BY_ID.dawn);
    expect(result.current.presentationWorld).toBe(WORLD_BY_ID.dawn);
  });

  it('falls back safely when storage contains an unknown world', async () => {
    await AsyncStorage.setItem(StorageKey.world, JSON.stringify('world-from-a-future-build'));

    const { result } = await mountWorld();

    expect(result.current.worldId).toBe(DEFAULT_WORLD_ID);
    expect(result.current.world).toBe(WORLD_BY_ID[DEFAULT_WORLD_ID]);
  });

  it('updates the active world and persists the selection', async () => {
    const { result } = await mountWorld();

    await act(async () => {
      await result.current.setWorld('dawn');
    });

    expect(result.current.worldId).toBe('dawn');
    expect(result.current.world).toBe(WORLD_BY_ID.dawn);
    expect(result.current.presentationWorld).toBe(WORLD_BY_ID.dawn);
    expect(await AsyncStorage.getItem(StorageKey.world)).toBe(JSON.stringify('dawn'));
  });

  it('presents a locked preview without persisting it', async () => {
    const { result } = await mountWorld();

    act(() => {
      result.current.setPreviewWorld('cloud');
    });

    expect(result.current.worldId).toBe(DEFAULT_WORLD_ID);
    expect(result.current.world).toBe(WORLD_BY_ID[DEFAULT_WORLD_ID]);
    expect(result.current.previewWorldId).toBe('cloud');
    expect(result.current.presentationWorldId).toBe('cloud');
    expect(result.current.presentationWorld).toBe(WORLD_BY_ID.cloud);
    expect(result.current.presentationWorld.appearance).toBe('light');
    expect(await AsyncStorage.getItem(StorageKey.world)).toBeNull();
  });

  it('clears the preview when an owned world is selected', async () => {
    const { result } = await mountWorld();

    act(() => {
      result.current.setPreviewWorld('tide');
    });

    await act(async () => {
      await result.current.setWorld('dawn');
    });

    expect(result.current.previewWorldId).toBeNull();
    expect(result.current.worldId).toBe('dawn');
    expect(result.current.presentationWorldId).toBe('dawn');
    expect(result.current.presentationWorld.appearance).toBe('light');
    expect(await AsyncStorage.getItem(StorageKey.world)).toBe(JSON.stringify('dawn'));
  });

  it('dismisses a preview without changing the persisted world', async () => {
    const { result } = await mountWorld();

    await act(async () => {
      await result.current.setWorld('forest');
    });

    act(() => {
      result.current.setPreviewWorld('cloud');
    });
    act(() => {
      result.current.setPreviewWorld(null);
    });

    expect(result.current.previewWorldId).toBeNull();
    expect(result.current.worldId).toBe('forest');
    expect(result.current.presentationWorld).toBe(WORLD_BY_ID.forest);
    expect(await AsyncStorage.getItem(StorageKey.world)).toBe(JSON.stringify('forest'));
  });
});
