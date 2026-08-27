import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';

import WorldPurchaseScreen from '@/app/world/[id]';
import { worldPurchaseBackingFill } from '@/components/worlds/WorldScene';
import { translate } from '@/lib/i18n';
import { en as mockEn } from '@/lib/i18n/en';
import { SHIPPED_LANGUAGES } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPurchaseWorld = jest.fn();
const mockRestoreWorlds = jest.fn();
const mockSetWorld = jest.fn();
const mockToggleSound = jest.fn();
const mockUseWorldSoundscape = jest.fn();
let mockSoundEnabled = true;
let mockOwned = false;
let mockFontScale = 1;
let mockWorldId = 'tide';

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ id: mockWorldId }),
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => true,
    dismissTo: mockDismissTo,
  }),
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(async () => {}),
}));

jest.mock('@/context/WorldContext', () => ({
  useWorld: () => ({ setWorld: mockSetWorld }),
}));

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: true,
    isWorldOwned: () => mockOwned,
    offerForWorld: () => ({ worldId: mockWorldId, priceLabel: '0,99 €', raw: null }),
    purchaseWorld: mockPurchaseWorld,
    restoreWorlds: mockRestoreWorlds,
  }),
}));

jest.mock('@/hooks/useCompactLayout', () => ({
  useCompactLayout: () => mockFontScale >= 1.5,
}));

jest.mock('@/hooks/useWorldSoundscape', () => ({
  useWorldSoundscape: (...args: unknown[]) => mockUseWorldSoundscape(...args),
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    setLanguage: async () => {},
    t: (key: keyof typeof mockEn, values?: Record<string, string | number>) => {
      const template = mockEn[key] ?? String(key);
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match
      );
    },
  }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));


function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

function worldPurchaseCopy(worldId: 'dawn' | 'tide') {
  const world = mockEn[`world.${worldId}.name`];
  const values = { world };
  const otherId = worldId === 'dawn' ? 'tide' : 'dawn';
  return {
    world,
    foreignWorld: mockEn[`world.${otherId}.name`],
    soundOn: interpolate(mockEn['world.purchase.preview.soundOn'], values),
    soundOff: interpolate(mockEn['world.purchase.preview.soundOff'], values),
    soundHint: interpolate(mockEn['world.purchase.preview.soundHint'], values),
    benefit1: interpolate(mockEn['world.purchase.benefit.1'], values),
    benefit2: interpolate(mockEn['world.purchase.benefit.2'], values),
    benefit3: interpolate(mockEn['world.purchase.benefit.3'], values),
    benefit4: interpolate(mockEn['world.purchase.benefit.4'], values),
    benefit5: interpolate(mockEn['world.purchase.benefit.5'], values),
    notPlusDetail: interpolate(mockEn['world.purchase.notPlus.detail'], values),
  };
}

describe('world purchase handoff', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockDismissTo.mockClear();
    mockPurchaseWorld.mockReset();
    mockRestoreWorlds.mockReset();
    mockSetWorld.mockReset();
    mockToggleSound.mockReset();
    mockUseWorldSoundscape.mockReset();
    mockSoundEnabled = true;
    mockOwned = false;
    mockFontScale = 1;
    mockWorldId = 'tide';
    mockToggleSound.mockImplementation(() => {
      mockSoundEnabled = !mockSoundEnabled;
    });
    mockUseWorldSoundscape.mockImplementation((_worldId: string, active: boolean) => ({
      soundEnabled: mockSoundEnabled,
      toggleSound: mockToggleSound,
      active,
    }));
    jest.mocked(Haptics.notificationAsync).mockClear();
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 360,
      height: 800,
      scale: 3,
      fontScale: mockFontScale,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the purchased world before returning to the journey', async () => {
    mockPurchaseWorld.mockResolvedValue(true);
    mockSetWorld.mockResolvedValue(undefined);

    render(<WorldPurchaseScreen />);
    fireEvent.press(screen.getByTestId(TID.Button.WorldPurchaseBuy));

    await waitFor(() => expect(mockSetWorld).toHaveBeenCalledWith('tide'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(mockDismissTo).toHaveBeenCalledWith('/(drawer)/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('selects the restored world before returning to the journey', async () => {
    mockRestoreWorlds.mockResolvedValue(['tide']);
    mockSetWorld.mockResolvedValue(undefined);

    render(<WorldPurchaseScreen />);
    fireEvent.press(screen.getByTestId(TID.Button.WorldPurchaseRestore));

    await waitFor(() => expect(mockSetWorld).toHaveBeenCalledWith('tide'));
    expect(mockDismissTo).toHaveBeenCalledWith('/(drawer)/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('makes the tide preview readable, concrete, and distinct from Plus', () => {
    const copy = worldPurchaseCopy('tide');
    render(<WorldPurchaseScreen />);

    expect(screen.getByTestId(TID.Button.WorldPurchaseBack)).toBeTruthy();
    expect(screen.getByText(copy.world)).toBeTruthy();
    expect(screen.queryByText(copy.foreignWorld)).toBeNull();
    expect(screen.getByText(copy.soundHint)).toBeTruthy();
    expect(screen.getByText(copy.benefit1)).toBeTruthy();
    expect(screen.getByText(copy.benefit2)).toBeTruthy();
    expect(screen.getByText(copy.benefit3)).toBeTruthy();
    expect(screen.getByText(copy.benefit4)).toBeTruthy();
    expect(screen.getByText(copy.benefit5)).toBeTruthy();
    expect(screen.getByText(mockEn['world.purchase.notPlus'])).toBeTruthy();
    expect(screen.getByText(copy.notPlusDetail)).toBeTruthy();
    expect(copy.notPlusDetail).toContain(copy.world);
    expect(copy.notPlusDetail).not.toContain(copy.foreignWorld);
    expect(screen.getByText(mockEn['world.purchase.oneTime'])).toBeTruthy();
    expect(screen.getByTestId(TID.Button.WorldPurchaseBuy)).toHaveTextContent(/Get · 0,99/);
    expect(screen.getByTestId('btn.worldPurchase.sound')).toHaveTextContent(copy.soundOn);
    expect(mockUseWorldSoundscape).toHaveBeenCalledWith('tide', false);
    const backingIds = [
      'world.purchase.chrome-backing',
      'world.purchase.intro-backing',
      'world.purchase.benefits-backing',
      'world.purchase.offer-backing',
      'world.purchase.actions-backing',
    ];
    for (const id of backingIds) {
      expect(screen.getByTestId(id).props.style).toMatchObject({
        backgroundColor: worldPurchaseBackingFill('dark'),
      });
    }
  });

  it('uses a paler local backing when the purchased world is daylight', () => {
    mockWorldId = 'dawn';
    render(<WorldPurchaseScreen />);
    expect(screen.getByTestId('world.purchase.intro-backing').props.style).toMatchObject({
      backgroundColor: worldPurchaseBackingFill('light'),
    });
    expect(screen.getByTestId('world.purchase.actions-backing').props.style).toMatchObject({
      backgroundColor: worldPurchaseBackingFill('light'),
    });
  });

  it('starts the optional sound preview only after an explicit tap', () => {
    const copy = worldPurchaseCopy('tide');
    const { rerender } = render(<WorldPurchaseScreen />);
    const soundButton = () => screen.getByTestId('btn.worldPurchase.sound');

    expect(mockUseWorldSoundscape).toHaveBeenCalledWith('tide', false);
    expect(soundButton()).toHaveTextContent(copy.soundOn);
    expect(soundButton().props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByLabelText(copy.soundOn)).toBeTruthy();

    fireEvent.press(soundButton());
    expect(mockToggleSound).not.toHaveBeenCalled();
    expect(mockPurchaseWorld).not.toHaveBeenCalled();

    rerender(<WorldPurchaseScreen />);
    expect(mockUseWorldSoundscape).toHaveBeenCalledWith('tide', true);
    expect(soundButton()).toHaveTextContent(copy.soundOff);
    expect(soundButton().props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText(copy.soundOff)).toBeTruthy();

    fireEvent.press(soundButton());
    expect(mockToggleSound).toHaveBeenCalledTimes(1);

    rerender(<WorldPurchaseScreen />);
    expect(soundButton()).toHaveTextContent(copy.soundOn);
    expect(soundButton().props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByLabelText(copy.soundOn)).toBeTruthy();
  });

  it('keeps buy, restore and back reachable at large text sizes', () => {
    mockFontScale = 2;
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 360,
      height: 800,
      scale: 3,
      fontScale: 2,
    });

    render(<WorldPurchaseScreen />);

    const chrome = screen.getByTestId('world.purchase.chrome-backing');
    const chromeClasses = String(chrome.props.className ?? '').split(/\s+/);
    expect(chromeClasses).not.toContain('flex-row');
    expect(chromeClasses).toContain('shrink-0');
    expect(screen.getByTestId('btn.worldPurchase.sound').props.className).toMatch(/self-start/);
    expect(screen.getByTestId('btn.worldPurchase.sound').props.className.split(/\s+/)).not.toContain('h-12');

    const back = screen.getByTestId(TID.Button.WorldPurchaseBack);
    const backWrapper = back.parent;
    const backClasses = String(backWrapper?.props?.className ?? '').split(/\s+/);
    expect(back).toHaveTextContent(mockEn['common.back']);
    expect(backClasses).toContain('self-start');
    expect(backClasses).not.toContain('flex-1');
    expect(screen.getByTestId(TID.Button.WorldPurchaseBuy)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.WorldPurchaseRestore)).toBeTruthy();
    expect(screen.getByText(worldPurchaseCopy('tide').benefit1)).toBeTruthy();
    expect(screen.getByText(mockEn['world.purchase.notPlus'])).toBeTruthy();
  });

  it('keeps dawn preview copy on dawn and tide copy on tide', () => {
    mockWorldId = 'dawn';
    const dawn = worldPurchaseCopy('dawn');
    const { unmount } = render(<WorldPurchaseScreen />);

    expect(screen.getByText(dawn.world)).toBeTruthy();
    expect(screen.queryByText(dawn.foreignWorld)).toBeNull();
    expect(screen.getByText(dawn.soundOn)).toBeTruthy();
    expect(screen.getByText(dawn.soundHint)).toBeTruthy();
    expect(screen.getByText(dawn.notPlusDetail)).toBeTruthy();
    expect(dawn.soundOn).toContain(dawn.world);
    expect(dawn.soundOn).not.toContain(dawn.foreignWorld);
    expect(dawn.notPlusDetail).toContain(dawn.world);
    expect(dawn.notPlusDetail).not.toContain(dawn.foreignWorld);
    expect(screen.queryByText(/Listen to the tide|ocean ambience|underwater night|Through the storm/i)).toBeNull();
    expect(mockUseWorldSoundscape).toHaveBeenCalledWith('dawn', false);
    unmount();

    mockWorldId = 'tide';
    const tide = worldPurchaseCopy('tide');
    render(<WorldPurchaseScreen />);

    expect(screen.getByText(tide.world)).toBeTruthy();
    expect(screen.queryByText(tide.foreignWorld)).toBeNull();
    expect(screen.getByText(tide.soundOn)).toBeTruthy();
    expect(screen.getByText(tide.notPlusDetail)).toBeTruthy();
    expect(tide.soundOn).toContain(tide.world);
    expect(tide.soundOn).not.toContain(tide.foreignWorld);
    expect(tide.notPlusDetail).toContain(tide.world);
    expect(tide.notPlusDetail).not.toContain(tide.foreignWorld);
    expect(mockUseWorldSoundscape).toHaveBeenCalledWith('tide', false);
  });

  it.each(SHIPPED_LANGUAGES)(
    '%s interpolates the unlocked world name and keeps dawn distinct from tide',
    (language) => {
      const dawnName = translate(language, 'world.dawn.name');
      const tideName = translate(language, 'world.tide.name');
      const dawnUnlock = translate(language, 'world.purchase.notPlus.detail', { world: dawnName });
      const tideUnlock = translate(language, 'world.purchase.notPlus.detail', { world: tideName });
      const dawnListen = translate(language, 'world.purchase.preview.soundOn', { world: dawnName });
      const tideListen = translate(language, 'world.purchase.preview.soundOn', { world: tideName });
      const hint = translate(language, 'world.purchase.preview.soundHint');
      const benefit2 = translate(language, 'world.purchase.benefit.2');

      expect(dawnName).not.toBe(tideName);
      expect(dawnUnlock).toContain(dawnName);
      expect(dawnUnlock).not.toContain(tideName);
      expect(tideUnlock).toContain(tideName);
      expect(tideUnlock).not.toContain(dawnName);
      expect(dawnListen).toContain(dawnName);
      expect(dawnListen).not.toContain(tideName);
      expect(tideListen).toContain(tideName);
      expect(tideListen).not.toContain(dawnName);
      expect(hint.toLowerCase()).not.toMatch(/ocean|océan|ozean|oceânico|oceanico/);
      expect(benefit2.toLowerCase()).not.toMatch(/storm|orage|sturm|tormenta|tempesta|tempestade/);
    }
  );
});
