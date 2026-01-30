/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TID } from '@/lib/testIDs';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockUseLocalSearchParams = vi.fn();

vi.mock('expo-router', () => ({
  router: { push: mockPush, back: mockBack },
  useLocalSearchParams: mockUseLocalSearchParams,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

const mockUseDreams = vi.fn();
vi.mock('@/context/DreamsContext', () => ({
  useDreams: () => mockUseDreams(),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const { default: DreamCategoriesScreen } = await import('../[id]');

describe('Dream categories screen', () => {
  it('[B] Given a dream When pressing a category Then it navigates to the chat route', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '123' });
    mockUseDreams.mockReturnValue({
      dreams: [{ id: 123, title: 'A dream', chatHistory: [] }],
    });

    // When
    render(<DreamCategoriesScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamCategory('symbols')));

    // Then
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dream-chat/[id]',
      params: { id: '123', category: 'symbols' },
    });
  });

  it('[E] Given an unknown dream id When rendering Then it shows a not-found message', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    mockUseDreams.mockReturnValue({ dreams: [] });

    // When
    render(<DreamCategoriesScreen />);

    // Then
    expect(screen.getByText('dream_categories.not_found.title')).toBeTruthy();
  });
});
