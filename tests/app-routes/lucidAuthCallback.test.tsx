/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import AuthCallbackScreen from '@/components/auth/AuthCallbackScreen';
import LucidCallback from '@/routes/lucid/auth/callback';
import LucidSuccess from '@/routes/lucid/auth/callback/success';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ screen: { background: '#000' }, accent: { text: '#fff' } }) }));
jest.mock('@/components/inspiration/AtmosphericBackground', () => ({ AtmosphericBackground: () => null }));
afterEach(() => { cleanup(); jest.clearAllMocks(); });
it.each([LucidCallback, LucidSuccess])('returns a Lucid callback to its own route', (Callback) => {
  render(<Callback />);
  expect(mockReplace).toHaveBeenCalledWith('/lucid');
  expect(mockReplace).not.toHaveBeenCalledWith('/recording');
});
it('preserves the existing Journal callback default', () => {
  render(<AuthCallbackScreen />);
  expect(mockReplace).toHaveBeenCalledWith('/recording');
});
