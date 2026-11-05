import { fireEvent, render, screen } from '@testing-library/react-native-legacy';
import React from 'react';

import { RouteScreenErrorFallback, ScreenErrorBoundary } from '../ScreenErrorBoundary';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: () => '/journal',
}));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/observe', () => ({ reportStabilityError: jest.fn() }));
jest.mock('@/context/ThemeContext', () => {
  const { DarkTheme, Shadows } = jest.requireActual('@/constants/journalTheme');
  return { useTheme: () => ({ colors: DarkTheme, mode: 'dark', shadows: Shadows.dark }) };
});

function Broken(): React.ReactElement {
  throw new Error('broken screen');
}

describe('ScreenErrorBoundary', () => {
  // The native release tour asserts this ID never shows: it must be on the card when it does.
  it('marks the fallback a screen shows after it throws', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ScreenErrorBoundary><Broken /></ScreenErrorBoundary>);
    expect(screen.getByTestId('screen.errorBoundary')).toBeTruthy();
  });

  it('marks the router fallback and leaves for Home without retrying', () => {
    const retry = jest.fn(async () => undefined);
    render(<RouteScreenErrorFallback error={new Error('broken route')} retry={retry} />);
    expect(screen.getByTestId('screen.errorBoundary')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('error.go_home'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(retry).not.toHaveBeenCalled();
  });
});
