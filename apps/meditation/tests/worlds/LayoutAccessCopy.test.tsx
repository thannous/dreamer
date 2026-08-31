/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import ProfileTab from '@/app/(drawer)/(tabs)/profile';
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
let mockSubscriptionsEnabled = true;
let mockFavorites = ['sleep-body-scan'];
let mockPracticeLog: { dateISO: string; sessionId: string; seconds: number }[] = [];

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    favorites: mockFavorites,
    isFavorite: (id: string) => mockFavorites.includes(id),
    progress: {},
    practiceLog: mockPracticeLog,
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    isPlus: mockIsPlus,
    subscriptionsEnabled: mockSubscriptionsEnabled,
  }),
}));

jest.mock('@/components/worlds/WorldScene', () => ({
  WorldScene: ({ children }: React.PropsWithChildren) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
}));

jest.mock('@/components/atmosphere/EmptyIllustration', () => ({
  EmptyIllustration: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'empty-illustration' });
  },
}));

jest.mock('@/hooks/useCompactLayout', () => ({
  useCompactLayout: () => false,
}));

jest.mock('@/hooks/useTabBarInset', () => ({
  useTabBarInset: () => 96,
  DrawerButtonClearance: 56,
}));

describe('TI-391 access, sound and settings copy', () => {
  beforeEach(() => {
    mockIsPlus = false;
    mockSubscriptionsEnabled = true;
    mockFavorites = ['sleep-body-scan'];
    mockPracticeLog = [];
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

  it('lets Sleep session cards differ by method and guidance, not only duration', () => {
    const descent = render(
      <SessionCard session={SESSION_BY_ID['sleep-descent']} testID="layout.sleep.descent" />
    );
    const quick = render(
      <SessionCard session={SESSION_BY_ID['sleep-quick-fall']} testID="layout.sleep.quick" />
    );
    const body = render(
      <SessionCard session={SESSION_BY_ID['sleep-body-scan']} testID="layout.sleep.body" />
    );
    const night = render(
      <SessionCard session={SESSION_BY_ID['sleep-night-return']} testID="layout.sleep.night" />
    );

    const methodLines = [
      descent.getByTestId('layout.sleep.descent.method'),
      quick.getByTestId('layout.sleep.quick.method'),
      body.getByTestId('layout.sleep.body.method'),
      night.getByTestId('layout.sleep.night.method'),
    ];
    const guidanceLines = [
      descent.getByTestId('layout.sleep.descent.guidance'),
      quick.getByTestId('layout.sleep.quick.guidance'),
      body.getByTestId('layout.sleep.body.guidance'),
      night.getByTestId('layout.sleep.night.guidance'),
    ];

    expect(methodLines[0]).toHaveTextContent('Method: Breathing');
    expect(guidanceLines[0]).toHaveTextContent('Guidance: Step by step');
    expect(methodLines[1]).toHaveTextContent('Method: Breathing');
    expect(guidanceLines[1]).toHaveTextContent('Guidance: Fades gradually');
    expect(methodLines[2]).toHaveTextContent('Method: Body awareness');
    expect(guidanceLines[2]).toHaveTextContent('Guidance: Step by step');
    expect(methodLines[3]).toHaveTextContent('Method: Open presence');
    expect(guidanceLines[3]).toHaveTextContent('Guidance: A few cues');

    const signatures = methodLines.map(
      (line, index) => `${line.props.children}::${guidanceLines[index].props.children}`
    );
    expect(new Set(signatures).size).toBe(4);

    for (const line of [...methodLines, ...guidanceLines]) {
      expect(line.props.numberOfLines).toBeUndefined();
      expect(line.props.adjustsFontSizeToFit).toBeUndefined();
    }

    const bodyLabel = body.getByRole('button').props.accessibilityLabel as string;
    expect(bodyLabel).toContain('Method: Body awareness');
    expect(bodyLabel).toContain('Guidance: Step by step');
    expect(bodyLabel).toContain('Saved, but Plus is still required');
  });

  it('still names a saved Plus session as locked when subscriptions remain enabled', () => {
    mockPracticeLog = [
      { dateISO: '2026-08-24', sessionId: 'sleep-body-scan', seconds: 600 },
    ];

    render(<ProfileTab />);

    expect(screen.getByTestId('profile.return.locked')).toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByTestId('profile.favorites.locked')).toHaveTextContent(
      'Saved sessions stay bookmarks. Plus is still required to play the locked ones.'
    );
  });

  it('does not announce a saved Plus session as locked when subscriptions are disabled', () => {
    mockSubscriptionsEnabled = false;
    mockIsPlus = false;

    render(
      <SessionCard session={SESSION_BY_ID['sleep-body-scan']} testID="layout.sleep.body" />
    );

    const bodyLabel = screen.getByRole('button').props.accessibilityLabel as string;
    expect(bodyLabel).toContain('Free');
    expect(bodyLabel).toContain('Saved');
    expect(bodyLabel).not.toContain('Plus is still required');
  });

  it('does not announce Plus as required on Profile while subscriptions are disabled', () => {
    mockSubscriptionsEnabled = false;
    mockIsPlus = false;
    mockPracticeLog = [
      { dateISO: '2026-08-24', sessionId: 'sleep-body-scan', seconds: 600 },
    ];

    render(<ProfileTab />);

    expect(screen.queryByTestId('profile.return.locked')).toBeNull();
    expect(screen.queryByTestId('profile.favorites.locked')).toBeNull();
    expect(screen.queryByText('Saved, but Plus is still required')).toBeNull();
    expect(
      screen.queryByText(
        'Saved sessions stay bookmarks. Plus is still required to play the locked ones.'
      )
    ).toBeNull();
  });

});
