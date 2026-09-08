/* eslint-disable @typescript-eslint/no-require-imports -- Jest module mocks. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { LibraryPersistenceNotice } from '@/components/library/LibraryPersistenceNotice';
import { translate } from '@/lib/i18n';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 32, bottom: 0, left: 0, right: 0 }) }));

const mockUseLibrary = jest.fn();
const mockLanguage = 'en' as const;

jest.mock('@/context/LibraryContext', () => ({
  useLibraryMetadata: () => mockUseLibrary(),
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: mockLanguage,
    setLanguage: async () => {},
    t: (key: string, values?: Record<string, string | number>) => {
      const { translate: translateCopy } = require('@/lib/i18n');
      return translateCopy(mockLanguage, key, values);
    },
  }),
}));

jest.mock('@/components/ui', () => ({
  Button: ({ label, onPress, loading, ...props }: { label: string; onPress: () => void; loading?: boolean }) => {
    const React = require('react');
    const { Pressable, Text: RNText } = require('react-native');
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityState: { busy: loading }, onPress, ...props },
      React.createElement(RNText, null, label)
    );
  },
  Card: ({ children, ...props }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, props, children);
  },
  Text: ({ children, ...props }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { Text: RNText } = require('react-native');
    return React.createElement(RNText, props, children);
  },
}));

describe('LibraryPersistenceNotice', () => {
  beforeEach(() => {
    mockUseLibrary.mockReset();
  });

  it('renders nothing while the library has no persistence error', () => {
    mockUseLibrary.mockReturnValue({
      loaded: true,
      persistenceError: null,
      retryPersistence: jest.fn(),
    });

    expect(render(<LibraryPersistenceNotice />).toJSON()).toBeNull();
  });

  it('describes a hydration failure and offers an accessible retry', async () => {
    const retryPersistence = jest.fn().mockResolvedValue(undefined);
    mockUseLibrary.mockReturnValue({
      loaded: false,
      persistenceError: new Error('storage unavailable'),
      retryPersistence,
    });

    render(<LibraryPersistenceNotice />);

    expect(screen.getByTestId('library.persistence.notice')).toHaveStyle({ paddingTop: 32 });
    expect(screen.getByText(translate('en', 'library.persistence.readError')).props.accessibilityRole).toBe('alert');
    expect(screen.getByText(translate('en', 'library.persistence.readError'))).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('library.persistence.retry'));
    });

    expect(retryPersistence).toHaveBeenCalledTimes(1);
  });

  it('uses the write message and swallows a rejected retry', async () => {
    const retryPersistence = jest.fn().mockRejectedValue(new Error('still unavailable'));
    mockUseLibrary.mockReturnValue({
      loaded: true,
      persistenceError: new Error('storage unavailable'),
      retryPersistence,
    });

    render(<LibraryPersistenceNotice />);
    expect(screen.getByText(translate('en', 'library.persistence.writeError'))).toBeTruthy();

    await expect(
      act(async () => {
        fireEvent.press(screen.getByTestId('library.persistence.retry'));
      })
    ).resolves.toBeUndefined();
    expect(retryPersistence).toHaveBeenCalledTimes(1);
  });
});
