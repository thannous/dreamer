/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import AuthCallbackScreen from '@/components/auth/AuthCallbackScreen';
import LucidCallback from '@/routes/lucid/auth/callback';
import LucidSuccess from '@/routes/lucid/auth/callback/success';

const mockReplace = jest.fn();
let mockReturnState: { ready: boolean; intent: { destination: string; createdAt: number } | null } = { ready: true, intent: null };
jest.mock('@/hooks/useAuthReturnIntent', () => ({ useAuthReturnIntent: () => mockReturnState }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ screen: { background: '#000' }, accent: { text: '#fff' } }) }));
jest.mock('@/components/inspiration/AtmosphericBackground', () => ({ AtmosphericBackground: () => null }));
afterEach(() => { cleanup(); jest.clearAllMocks(); mockReturnState = { ready: true, intent: null }; });
it.each([LucidCallback, LucidSuccess])('returns a Lucid callback to its own route', (Callback) => {
  render(<Callback />);
  expect(mockReplace).toHaveBeenCalledWith('/lucid');
  expect(mockReplace).not.toHaveBeenCalledWith('/recording');
});
it('preserves the existing Journal callback default', () => {
  render(<AuthCallbackScreen />);
  expect(mockReplace).toHaveBeenCalledWith('/recording');
});
it('does not race a pending dream return or its storage restoration with Capture', () => {
  mockReturnState = { ready: false, intent: null };
  const view = render(<AuthCallbackScreen />);
  expect(mockReplace).not.toHaveBeenCalled();
  mockReturnState = { ready: true, intent: { destination: '/journal/42', createdAt: Date.now() } };
  view.rerender(<AuthCallbackScreen />);
  expect(mockReplace).not.toHaveBeenCalled();
});
