/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

jest.mock('@/components/auth/ResetPasswordScreen', () => ({
  __esModule: true,
  default: () => <div data-testid="reset-password-screen" />,
}));

const { default: ResetPasswordRoute } = require('@/app/auth/reset-password');

describe('auth/reset-password route', () => {
  afterEach(() => {
    cleanup();
  });

  it('mounts the reset password screen', () => {
    render(<ResetPasswordRoute />);

    expect(screen.getByTestId('reset-password-screen')).toBeTruthy();
  });
});
