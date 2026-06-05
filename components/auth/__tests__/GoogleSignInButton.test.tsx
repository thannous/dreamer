/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert, Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

const mockSignInWithGoogle = jest.fn();
const mockSignInWithGoogleWeb = jest.fn();
const mockRequestStayOnSettingsIntent = jest.fn();
const mockClearStayOnSettingsIntent = jest.fn();
const mockAlert = jest.fn();
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

jest.mock('react-native', () => {
  const React = require('react');
  const Platform = {
    OS: 'android',
    select: (options: Record<string, unknown>) => options[Platform.OS] ?? options.default,
  };

  return {
    Alert: { alert: () => {} },
    Platform,
    ActivityIndicator: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
    Pressable: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('@/lib/auth', () => ({
  signInWithGoogle: mockSignInWithGoogle,
  signInWithGoogleWeb: mockSignInWithGoogleWeb,
}));

jest.mock('@/lib/navigationIntents', () => ({
  requestStayOnSettingsIntent: mockRequestStayOnSettingsIntent,
  clearStayOnSettingsIntent: mockClearStayOnSettingsIntent,
}));

jest.mock('@/lib/logger', () => ({
  createScopedLogger: () => mockLogger,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundSecondary: '#fff',
      textPrimary: '#111',
      textSecondary: '#777',
    },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="google-icon" />,
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { sm: 4 },
    spacing: { sm: 8, md: 16 },
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
    },
  },
}));

const GoogleSignInButton = require('../GoogleSignInButton').default;

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as typeof Platform & { OS: string }).OS = 'android';
    Alert.alert = mockAlert;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a generic alert without error logging for Google developer errors', async () => {
    const developerError = Object.assign(new Error('DEVELOPER_ERROR'), {
      code: 'DEVELOPER_ERROR',
    });
    mockSignInWithGoogle.mockRejectedValueOnce(developerError);

    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthGoogle));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'auth.google.error_title',
        'auth.google.error_generic'
      );
    });

    expect(mockClearStayOnSettingsIntent).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Sign-in failed', developerError);
    expect(mockLogger.warn).toHaveBeenCalledWith('Showing generic error alert', {
      errorCode: 'DEVELOPER_ERROR',
      errorMessage: 'DEVELOPER_ERROR',
    });
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
