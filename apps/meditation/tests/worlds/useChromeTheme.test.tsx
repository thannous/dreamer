import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { NightTheme, PaperTheme, type ThemeMode } from '@/constants/theme';
import { DEFAULT_WORLD_ID, WORLD_BY_ID } from '@/constants/worlds';
import { WorldProvider, useWorld } from '@/context/WorldContext';
import { useChromeTheme } from '@/hooks/useChromeTheme';
import { StorageKey } from '@/services/storageService';

let mockPathname = '/';
let mockAppMode: ThemeMode = 'dark';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: mockAppMode }),
}));

const useChromeAndWorld = () => ({
  chrome: useChromeTheme(),
  world: useWorld(),
});

const mountChrome = async () => {
  const view = renderHook(() => useChromeAndWorld(), { wrapper: WorldProvider });
  await waitFor(() => expect(view.result.current.world.loaded).toBe(true));
  return view;
};

describe('useChromeTheme', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockAppMode = 'dark';
  });

  it('follows the selected world on the immersive home', async () => {
    const view = await mountChrome();

    expect(view.result.current.chrome).toMatchObject({
      mode: 'dark',
      colors: NightTheme,
      followsWorld: true,
    });
    expect(view.result.current.world.presentationWorld).toBe(WORLD_BY_ID[DEFAULT_WORLD_ID]);
  });

  it('switches chrome from dark to light with the presented world', async () => {
    const view = await mountChrome();

    await act(async () => {
      await view.result.current.world.setWorld('dawn');
    });

    expect(view.result.current.chrome).toMatchObject({
      mode: 'light',
      colors: PaperTheme,
      followsWorld: true,
    });

    await act(async () => {
      await view.result.current.world.setWorld('forest');
    });

    expect(view.result.current.chrome).toMatchObject({
      mode: 'dark',
      colors: NightTheme,
      followsWorld: true,
    });
  });

  it('follows a locked light preview instead of the persisted dark world', async () => {
    const view = await mountChrome();

    act(() => {
      view.result.current.world.setPreviewWorld('cloud');
    });

    expect(view.result.current.world.worldId).toBe(DEFAULT_WORLD_ID);
    expect(view.result.current.world.world.appearance).toBe('dark');
    expect(view.result.current.chrome).toMatchObject({
      mode: 'light',
      colors: PaperTheme,
      followsWorld: true,
    });
    expect(await AsyncStorage.getItem(StorageKey.world)).toBeNull();
  });

  it.each(['/breathe', '/search', '/profile'])('follows the selected world on %s', async (pathname) => {
    const view = await mountChrome();

    await act(async () => {
      await view.result.current.world.setWorld('dawn');
    });

    mockPathname = pathname;
    view.rerender(undefined);

    expect(view.result.current.chrome).toMatchObject({
      mode: 'light',
      colors: PaperTheme,
      followsWorld: true,
    });
  });

  it('does not leak a locked Home preview into another world-aware tab', async () => {
    const view = await mountChrome();

    act(() => {
      view.result.current.world.setPreviewWorld('cloud');
    });

    mockPathname = '/search';
    view.rerender(undefined);

    expect(view.result.current.chrome).toMatchObject({
      mode: 'dark',
      colors: NightTheme,
      followsWorld: true,
    });
  });

  it('returns to the app theme outside the immersive tabs', async () => {
    const view = await mountChrome();

    await act(async () => {
      await view.result.current.world.setWorld('dawn');
    });

    mockPathname = '/settings';
    mockAppMode = 'dark';
    view.rerender(undefined);

    expect(view.result.current.chrome).toMatchObject({
      mode: 'dark',
      colors: NightTheme,
      followsWorld: false,
    });
  });
});
