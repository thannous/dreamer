import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { BackLink } from '@/components/ui/BackLink';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    replace: mockReplace,
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: { accentText: '#ffffff' } }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

describe('BackLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true;
  });

  it('commits only one route pop when the control is pressed repeatedly', () => {
    render(<BackLink label="Back" fallbackHref="/goals" />);

    const backLink = screen.getByRole('button', { name: 'Back' });
    fireEvent.press(backLink);
    fireEvent.press(backLink);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('uses the screen fallback when a cold deep link has no history', () => {
    mockCanGoBack = false;
    render(<BackLink label="Back" fallbackHref="/goals" />);

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/goals');
  });
});
