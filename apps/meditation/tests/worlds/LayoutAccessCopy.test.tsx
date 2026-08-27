/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { DailyRitualShelf } from '@/components/journey/DailyRitualShelf';
import { UpcomingJourneyRail } from '@/components/journey/UpcomingJourneyRail';
import { WorldJourneyPicker } from '@/components/journey/WorldJourneyPicker';
import { SessionCard } from '@/components/session/SessionCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { TrainerControls } from '@/components/trainer/TrainerControls';
import { WORLD_BY_ID } from '@/constants/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
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

let mockIsPlus = false;

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    favorites: ['sleep-body-scan'],
    isFavorite: (id: string) => id === 'sleep-body-scan',
    progress: {},
    practiceLog: [],
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({ isPlus: mockIsPlus }),
}));

describe('TI-391 access, sound and settings copy', () => {
  beforeEach(() => {
    mockIsPlus = false;
  });

  it('keeps Free/Plus wording aligned across the six catalogues', () => {
    expect(translate('en', 'common.free')).toBe('Free');
    expect(translate('fr', 'common.free')).toBe('Gratuit');
    expect(translate('de', 'common.free')).toBe('Kostenlos');
    expect(translate('es', 'common.free')).toBe('Gratis');
    expect(translate('it', 'common.free')).toBe('Gratuita');
    expect(translate('pt', 'common.free')).toBe('Grátis');
    expect(translate('fr', 'complete.home')).toBe('Retour à l’accueil');
    expect(translate('fr', 'trainer.sound.on')).toBe('Couper le son');
    expect(translate('fr', 'trainer.sound.off')).toBe('Activer le son');
  });

  it('explains that a saved Plus session is still locked', () => {
    render(
      <SessionCard session={SESSION_BY_ID['sleep-body-scan']} testID="layout.plus.saved" />
    );

    expect(screen.getByTestId('layout.plus.saved.access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('layout.plus.saved.saved')).toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByRole('button').props.accessibilityLabel).toEqual(
      expect.stringContaining('Saved, but Plus is still required')
    );
  });

  it('names the sound switch by the action that the current state will take', () => {
    render(
      <TrainerControls
        actionLabel="Begin"
        appearance="dark"
        compact={false}
        durationLabel="Duration"
        durationMin={3}
        durations={[{ label: '3 min', value: 3 }]}
        showDurations={false}
        soundEnabled
        soundLabel={translate('en', 'trainer.sound.on')}
        soundName={translate('en', 'trainer.sound')}
        soundTestID="layout.sound"
        testID="layout.action"
        onAction={() => {}}
        onDurationChange={() => {}}
        onToggleSound={() => {}}
      />
    );

    expect(screen.getByTestId('layout.sound').props.accessibilityLabel).toBe('Mute sound');
    expect(screen.getByTestId('layout.sound').props.accessibilityRole).toBe('switch');
    expect(screen.getByTestId('layout.sound')).toHaveTextContent('Sound');
  });

  it('presents Reduce animations as a system fact, not a toggle', () => {
    render(
      <SettingsRow
        testID="layout.motion"
        label={translate('en', 'settings.motion')}
        value={translate('en', 'settings.motion.system')}
      />
    );

    const row = screen.getByTestId('layout.motion');
    expect(row.props.accessibilityRole).toBe('text');
    expect(row.props.accessibilityLabel).toBe('Reduce animations. Follows your device setting');
  });

  it('names an owned Plus session as active instead of still locked', () => {
    mockIsPlus = true;
    render(<SessionCard session={SESSION_BY_ID['sleep-body-scan']} testID="layout.plus.owned" />);

    expect(screen.getByTestId('layout.plus.owned.access')).toHaveTextContent('Noctalia Plus is active');
    expect(screen.getByTestId('layout.plus.owned.saved')).toHaveTextContent('Saved');
    expect(screen.getByTestId('layout.plus.owned.saved')).not.toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByRole('button').props.accessibilityLabel).toEqual(
      expect.stringContaining('Noctalia Plus is active')
    );
  });

  it('lets essential journey titles reflow instead of shrinking or truncating', () => {
    const worldView = render(
      <WorldJourneyPicker
        worlds={[WORLD_BY_ID.constellation]}
        selectedWorldId="constellation"
        onSelect={() => {}}
        isWorldOwned={() => true}
        priceForWorld={() => undefined}
        testID="home.world-switcher"
      />
    );
    const ritualView = render(
      <DailyRitualShelf
        session={SESSION_BY_ID['sleep-descent']}
        journeyProgress={{}}
        world={WORLD_BY_ID.constellation}
        accessGate={{ allowed: true }}
        remainingPlays={3}
        quotaResetDay="2026-09-01"
        isPlus={false}
        onOpen={() => {}}
        onOpenPaywall={() => {}}
      />
    );
    const upcomingView = render(
      <UpcomingJourneyRail
        sessions={[SESSION_BY_ID['dream-threshold']]}
        appearance="dark"
        onOpen={() => {}}
      />
    );

    const worldName = worldView.getByTestId('home.world-switcher.constellation.name');
    const ritualTitle = ritualView.getByTestId('home.journey.ritual-title');
    const upcomingTitle = upcomingView.getByTestId('home.journey.upcoming.dream-threshold.title');

    for (const title of [worldName, ritualTitle, upcomingTitle]) {
      expect(title.props.numberOfLines).toBeUndefined();
      expect(title.props.adjustsFontSizeToFit).toBeUndefined();
      expect(title.props.minimumFontScale).toBeUndefined();
      expect(title.props.allowFontScaling).not.toBe(false);
    }

    expect(worldName).toHaveTextContent('Constellation');
    expect(ritualTitle).toHaveTextContent('Bringing the breath down');
    expect(upcomingTitle).toHaveTextContent('The threshold');
  });

});
