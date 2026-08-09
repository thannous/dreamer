import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import {
  RELEASE_NOTES_VERSION,
  WhatsNewModal,
  WhatsNewModalHost,
} from '@/components/releases/WhatsNewModal';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;
const mockGetLastSeenReleaseNotesVersion = typedJestFn<() => Promise<string | null>>();
const mockSaveLastSeenReleaseNotesVersion = typedJestFn<
  (version: string) => Promise<void>
>();

let mockMode: 'light' | 'dark' = 'dark';
let mockOnboardingStatus: 'not_started' | 'completed' | 'skipped' = 'completed';
let mockOnboardingLoading = false;
let mockOnboardingScope = 'guest:default';

jest.mock('react-native', () => {
  const React = require('react');
  const createNativeElement = (name: string) => {
    const NativeElement = ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(name, props, children);
    NativeElement.displayName = name;
    return NativeElement;
  };
  const MockModal = ({ children, visible }: { children?: React.ReactNode; visible: boolean }) =>
    visible ? React.createElement(React.Fragment, null, children) : null;
  const flatten = (style: unknown): Record<string, unknown> =>
    (Array.isArray(style) ? style : [style]).reduce<Record<string, unknown>>(
      (result, entry) => ({
        ...result,
        ...(Array.isArray(entry) ? flatten(entry) : entry && typeof entry === 'object' ? entry : {}),
      }),
      {}
    );

  return {
    AccessibilityInfo: { setAccessibilityFocus: () => undefined },
    findNodeHandle: () => 1,
    Modal: MockModal,
    Platform: {
      OS: 'ios',
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
    Pressable: createNativeElement('Pressable'),
    ScrollView: createNativeElement('ScrollView'),
    StyleSheet: {
      absoluteFill: { position: 'absolute', inset: 0 },
      absoluteFillObject: { position: 'absolute', inset: 0 },
      create: <T,>(styles: T) => styles,
      flatten,
      hairlineWidth: 1,
    },
    Text: createNativeElement('Text'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    View: createNativeElement('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    loading: mockOnboardingLoading,
    scope: mockOnboardingScope,
    state: { status: mockOnboardingStatus },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: mockMode,
    shadows: { xl: {} },
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: (_colors: unknown, mode: 'light' | 'dark') => ({
    text: { primary: mode === 'dark' ? '#fff' : '#222', secondary: '#777', tertiary: '#888' },
    accent: { base: '#D4A574', strong: '#9A6332', soft: '#EAD4B4' },
    surface: { soft: '#eee', border: '#ddd', borderStrong: '#ccc' },
    action: { primary: '#D4A574', primaryBorder: '#EAD4B4', primaryText: '#3B2412' },
  }),
}));

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const copy: Record<string, string> = {
  'release_notes.badge': 'NOUVEAUTÉS · {version}',
  'release_notes.title': 'Noctalia 3.1 est là',
  'release_notes.subtitle': 'De nouveaux repères pour lire tes rêves dans la durée.',
  'release_notes.stats.title': 'Des statistiques plus riches',
  'release_notes.stats.body': 'Visualise ton rythme de journal et tes périodes les plus actives.',
  'release_notes.patterns.title': 'Tes tendances oniriques',
  'release_notes.patterns.body': 'Repère tes émotions dominantes et l’évolution de tes thèmes avec Plus.',
  'release_notes.android.title': 'Android plus fluide',
  'release_notes.android.body': 'Profite d’un démarrage plus rapide et d’une expérience plus stable.',
  'release_notes.navigation.title': 'Une navigation plus claire',
  'release_notes.navigation.body': 'Des repères plus lisibles et de nouvelles améliorations d’accessibilité.',
  'release_notes.primary': 'Voir mes statistiques',
  'release_notes.later': 'Plus tard',
  'release_notes.close': 'Fermer les nouveautés',
};

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string | number>) => {
      let value = copy[key] ?? key;
      for (const [name, replacement] of Object.entries(replacements ?? {})) {
        value = value.replace(`{${name}}`, String(replacement));
      }
      return value;
    },
  }),
}));

jest.mock('@/services/storageService', () => ({
  getLastSeenReleaseNotesVersion: () => mockGetLastSeenReleaseNotesVersion(),
  saveLastSeenReleaseNotesVersion: (version: string) =>
    mockSaveLastSeenReleaseNotesVersion(version),
}));

describe('WhatsNewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMode = 'dark';
    mockOnboardingStatus = 'completed';
    mockOnboardingLoading = false;
    mockOnboardingScope = 'guest:default';
    mockGetLastSeenReleaseNotesVersion.mockResolvedValue(null);
    mockSaveLastSeenReleaseNotesVersion.mockResolvedValue(undefined);
  });

  it('renders the 3.1.0 release copy and exposes every dismissal path', () => {
    const onClose = jest.fn();
    const onPrimary = jest.fn();
    const view = render(
      <WhatsNewModal visible onClose={onClose} onPrimary={onPrimary} />
    );

    expect(view.getByText(`NOUVEAUTÉS · ${RELEASE_NOTES_VERSION}`)).toBeTruthy();
    expect(view.getByText('Des statistiques plus riches')).toBeTruthy();
    expect(view.getByText('Tes tendances oniriques')).toBeTruthy();
    expect(view.getByText('Android plus fluide')).toBeTruthy();
    expect(view.getByText('Une navigation plus claire')).toBeTruthy();

    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewLater));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewClose));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('adapts its elevated surface to dark and light themes', () => {
    const view = render(<WhatsNewModal visible onClose={jest.fn()} onPrimary={jest.fn()} />);
    const darkStyle = StyleSheet.flatten(view.getByTestId(TID.Component.WhatsNewCard).props.style);
    expect(darkStyle.backgroundColor).toBe('rgba(13, 11, 28, 0.98)');

    mockMode = 'light';
    view.rerender(<WhatsNewModal visible onClose={jest.fn()} onPrimary={jest.fn()} />);
    const lightStyle = StyleSheet.flatten(view.getByTestId(TID.Component.WhatsNewCard).props.style);
    expect(lightStyle.backgroundColor).toBe('rgba(255, 253, 248, 0.99)');
  });

  it('shows once after onboarding and persists the version before opening statistics', async () => {
    const view = render(<WhatsNewModalHost ready />);

    await waitFor(() => expect(view.getByTestId(TID.Modal.WhatsNew)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));

    expect(mockSaveLastSeenReleaseNotesVersion).toHaveBeenCalledWith(RELEASE_NOTES_VERSION);
    expect(mockPush).toHaveBeenCalledWith('/statistics');
  });

  it('does not show during onboarding or after this release was seen', async () => {
    mockOnboardingStatus = 'not_started';
    const onboardingView = render(<WhatsNewModalHost ready />);
    expect(onboardingView.queryByTestId(TID.Modal.WhatsNew)).toBeNull();
    expect(mockGetLastSeenReleaseNotesVersion).not.toHaveBeenCalled();

    onboardingView.unmount();
    mockOnboardingStatus = 'skipped';
    mockGetLastSeenReleaseNotesVersion.mockResolvedValue(RELEASE_NOTES_VERSION);
    const seenView = render(<WhatsNewModalHost ready />);

    await waitFor(() => expect(mockGetLastSeenReleaseNotesVersion).toHaveBeenCalledTimes(1));
    expect(seenView.queryByTestId(TID.Modal.WhatsNew)).toBeNull();
  });

  it('marks release notes seen without interrupting a freshly completed onboarding', async () => {
    mockOnboardingStatus = 'not_started';
    const view = render(<WhatsNewModalHost ready />);

    expect(view.queryByTestId(TID.Modal.WhatsNew)).toBeNull();

    mockOnboardingStatus = 'completed';
    view.rerender(<WhatsNewModalHost ready />);

    await waitFor(() =>
      expect(mockSaveLastSeenReleaseNotesVersion).toHaveBeenCalledWith(RELEASE_NOTES_VERSION)
    );
    expect(mockGetLastSeenReleaseNotesVersion).not.toHaveBeenCalled();
    expect(view.queryByTestId(TID.Modal.WhatsNew)).toBeNull();
  });
});
