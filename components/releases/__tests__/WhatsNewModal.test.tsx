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
  'release_notes.title': 'Noctalia évolue',
  'release_notes.subtitle': 'Vos rêves, encore plus loin.',
  'release_notes.analysis.title': 'Analyse améliorée',
  'release_notes.analysis.body': 'Des lectures plus profondes et plus personnelles.',
  'release_notes.guides.title': 'Nouveaux guides',
  'release_notes.guides.body': 'Explorez les grands thèmes de vos rêves.',
  'release_notes.capture.title': 'Capture simplifiée',
  'release_notes.capture.body': 'Écrivez ou dictez plus facilement.',
  'release_notes.settings.title': 'Paramètres repensés',
  'release_notes.settings.body': 'Tout est plus simple à retrouver.',
  'release_notes.primary': 'Découvrir les nouveautés',
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
    mockGetLastSeenReleaseNotesVersion.mockResolvedValue(null);
    mockSaveLastSeenReleaseNotesVersion.mockResolvedValue(undefined);
  });

  it('renders the 3.0.0 release copy and exposes every dismissal path', () => {
    const onClose = jest.fn();
    const onPrimary = jest.fn();
    const view = render(
      <WhatsNewModal visible onClose={onClose} onPrimary={onPrimary} />
    );

    expect(view.getByText(`NOUVEAUTÉS · ${RELEASE_NOTES_VERSION}`)).toBeTruthy();
    expect(view.getByText('Analyse améliorée')).toBeTruthy();
    expect(view.getByText('Nouveaux guides')).toBeTruthy();
    expect(view.getByText('Capture simplifiée')).toBeTruthy();
    expect(view.getByText('Paramètres repensés')).toBeTruthy();

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

  it('shows once after onboarding and persists the version before opening guides', async () => {
    const view = render(<WhatsNewModalHost ready />);

    await waitFor(() => expect(view.getByTestId(TID.Modal.WhatsNew)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));

    expect(mockSaveLastSeenReleaseNotesVersion).toHaveBeenCalledWith(RELEASE_NOTES_VERSION);
    expect(mockPush).toHaveBeenCalledWith('/dream-guides');
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
});
