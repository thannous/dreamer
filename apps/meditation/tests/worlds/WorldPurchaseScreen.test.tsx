import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import WorldPurchaseScreen from '@/app/world/[id]';
import { TID } from '@/lib/testIDs';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPurchaseWorld = jest.fn();
const mockRestoreWorlds = jest.fn();
const mockSetWorld = jest.fn();

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ id: 'tide' }),
  useRouter: () => ({ back: mockBack, dismissTo: mockDismissTo }),
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
    isWorldOwned: () => false,
    offerForWorld: () => ({ worldId: 'tide', priceLabel: '0,99 €', raw: null }),
    purchaseWorld: mockPurchaseWorld,
    restoreWorlds: mockRestoreWorlds,
  }),
}));

jest.mock('@/hooks/useCompactLayout', () => ({
  useCompactLayout: () => false,
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

describe('world purchase handoff', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockDismissTo.mockClear();
    mockPurchaseWorld.mockReset();
    mockRestoreWorlds.mockReset();
    mockSetWorld.mockReset();
    jest.mocked(Haptics.notificationAsync).mockClear();
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
});
