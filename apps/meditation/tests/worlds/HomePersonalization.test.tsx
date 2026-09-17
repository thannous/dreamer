import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DailyReturnCard } from '@/components/profile/DailyReturnCard';
import { SESSION_BY_ID } from '@/content/sessions';

const mockPress = jest.fn();

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

describe('daily return personalization', () => {
  beforeEach(() => {
    mockPress.mockClear();
  });

  it('offers a recent familiar session before any scoreboard copy', () => {
    render(
      <DailyReturnCard
        offer={{ kind: 'recent', session: SESSION_BY_ID['sleep-descent'] }}
        practisedToday={false}
        locked={false}
        appearance="dark"
        onPress={mockPress}
      />
    );

    expect(screen.getByTestId('profile.return.title')).toHaveTextContent('A familiar pause is ready');
    expect(screen.getByTestId('profile.return.subtitle')).toHaveTextContent(
      /Return to .* · 10 min/
    );
    expect(screen.getByTestId('profile.return.cta')).toHaveTextContent('Open this session');
    expect(screen.queryByText('Not yet today')).toBeNull();
    expect(screen.queryByText('Best run')).toBeNull();
    expect(screen.queryByText(/missed/i)).toBeNull();

    fireEvent.press(screen.getByTestId('profile.return.cta'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  it('congratulates a completed day without a missed-streak reprimand', () => {
    render(
      <DailyReturnCard
        offer={{ kind: 'recent', session: SESSION_BY_ID['sleep-descent'] }}
        practisedToday
        locked={false}
        appearance="dark"
        onPress={mockPress}
      />
    );

    expect(screen.getByTestId('profile.return.title')).toHaveTextContent('Practised today');
    expect(screen.getByTestId('profile.return.subtitle')).toHaveTextContent(
      /Return to .* · 10 min/
    );
    expect(screen.queryByText('Not yet today')).toBeNull();
    expect(screen.queryByText(/missed/i)).toBeNull();
  });

  it('keeps a locked saved session as a bookmark, not as acquired access', () => {
    render(
      <DailyReturnCard
        offer={{ kind: 'saved', session: SESSION_BY_ID['sleep-body-scan'] }}
        practisedToday={false}
        locked
        appearance="dark"
        onPress={mockPress}
      />
    );

    expect(screen.getByTestId('profile.return.subtitle')).toHaveTextContent(
      /A saved session waits/
    );
    expect(screen.getByTestId('profile.return.locked')).toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByTestId('profile.return.cta')).toHaveTextContent('Open a saved session');
    expect(screen.queryByText(/^Begin$/)).toBeNull();
    expect(screen.queryByText('Commencer')).toBeNull();
  });
});
