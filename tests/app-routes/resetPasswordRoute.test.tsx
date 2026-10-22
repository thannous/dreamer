/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

let mockParams: Record<string, string | string[] | undefined> = {};
const mockSetParams = jest.fn();

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { setParams: mockSetParams },
}));
jest.mock('@/components/auth/ResetPasswordScreen', () => ({
  __esModule: true,
  default: ({ nativeRecoveryLink }: { nativeRecoveryLink?: { state: string; tokenHash?: string } }) => (
    <div data-testid="reset-route" data-state={nativeRecoveryLink?.state} data-token={nativeRecoveryLink?.tokenHash} />
  ),
}));

const { default: ResetPasswordRoute } = require('../../app/auth/reset-password') as typeof import('../../app/auth/reset-password');

afterEach(() => {
  cleanup();
  Platform.OS = 'web';
  mockParams = {};
  mockSetParams.mockClear();
});

it('retains a native recovery proof in memory while removing it from route params', () => {
  Platform.OS = 'ios';
  mockParams = { token_hash: 'one-use-hash', type: 'recovery' };
  const view = render(<ResetPasswordRoute />);

  expect(screen.getByTestId('reset-route').getAttribute('data-state')).toBe('pending');
  expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({
    token_hash: undefined, type: undefined,
  }));

  mockParams = {};
  view.rerender(<ResetPasswordRoute />);
  expect(screen.getByTestId('reset-route').getAttribute('data-token')).toBe('one-use-hash');
});

it('keeps the web route on its separately quarantined auth path', () => {
  mockParams = { token_hash: 'web-hash', type: 'recovery' };
  render(<ResetPasswordRoute />);
  expect(screen.getByTestId('reset-route').getAttribute('data-state')).toBeNull();
  expect(mockSetParams).not.toHaveBeenCalled();
});
