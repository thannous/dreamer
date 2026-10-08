/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { render } from '@testing-library/react-native';
import React from 'react';

import { SessionCard } from '@/components/session/SessionCard';
import { SESSIONS } from '@/content/sessions';
import { getSessionPractice } from '@/content/sessionPractice';
import { translate } from '@/lib/i18n';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: ({ children }: React.PropsWithChildren) => React.createElement(View, null, children) };
});

jest.mock('@/components/session/SessionArtwork', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SessionArtwork: ({ children }: React.PropsWithChildren) => React.createElement(View, null, children),
  };
});

jest.mock('@/context/LibraryContext', () => {
  const useLibrary = () => ({
    favorites: [],
    isFavorite: () => false,
    progress: {},
    practiceLog: [],
  });
  return { useLibrary, useLibraryMetadata: useLibrary };
});

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({ isPlus: false }),
}));

describe('SessionCard method', () => {
  it('shows the method on every catalogue card, including TalkBack, without promising guidance', () => {
    expect(SESSIONS).toHaveLength(24);

    for (const session of SESSIONS) {
      const view = render(<SessionCard session={session} testID={`practice.${session.id}`} />);
      const practice = getSessionPractice(session.id);
      const method = translate('en', 'session.method.label', {
        method: translate('en', `session.method.${practice.method}` as 'session.method.breath'),
      });

      const methodLine = view.getByTestId(`practice.${session.id}.method`);
      expect(methodLine).toHaveTextContent(method);
      expect(methodLine.props.numberOfLines).toBeUndefined();
      // v1 sessions are timed ambiences with no spoken guidance.
      expect(view.queryByText(/guidance|step by step/i)).toBeNull();

      const label = view.getByRole('button').props.accessibilityLabel as string;
      expect(label).toContain(method);
      expect(label).not.toMatch(/guidance/i);
      view.unmount();
    }
  });
});
