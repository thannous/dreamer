import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
    accent: { base: '#D4A574', strong: '#9A6332', soft: '#EAD4B4', text: '#9A6332'},
    surface: { raised: mode === 'dark' ? '#14131A' : '#F5EADB', soft: '#eee', border: '#ddd', borderStrong: '#ccc' },
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
  "release_notes.badge": "NOUVEAUTÉS · {version}",
  "release_notes.title": "Noctalia 3.5 est là",
  "release_notes.subtitle": "Des symboles illustrés pour mieux lire tes rêves.",
  "release_notes.symbols.title": "160 symboles illustrés",
  "release_notes.symbols.body": "Le dictionnaire des symboles est désormais illustré, comme sur noctalia.app.",
  "release_notes.symbol_pages.title": "Des fiches plus lisibles",
  "release_notes.symbol_pages.body": "Chaque fiche présente l’interprétation, les variations, des questions à te poser et les symboles liés.",
  "release_notes.readability.title": "Grandes tailles de texte",
  "release_notes.readability.body": "L’affichage est corrigé quand tu utilises de grandes tailles de texte.",
  "release_notes.primary": "Explorer les symboles",
  "release_notes.later": "Plus tard",
  "release_notes.close": "Fermer les nouveautés"
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

  it('renders the current release copy and exposes every dismissal path', () => {
    const onClose = jest.fn();
    const onPrimary = jest.fn();
    const view = render(
      <WhatsNewModal visible onClose={onClose} onPrimary={onPrimary} />
    );

    expect(view.getByText(`NOUVEAUTÉS · ${RELEASE_NOTES_VERSION}`)).toBeTruthy();
    expect(view.getByText('160 symboles illustrés')).toBeTruthy();
    expect(view.getByText('Des fiches plus lisibles')).toBeTruthy();
    expect(view.getByText('Grandes tailles de texte')).toBeTruthy();

    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewLater));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewClose));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows once after onboarding and persists the version before opening the symbol dictionary', async () => {
    const view = render(<WhatsNewModalHost ready />);

    await waitFor(() => expect(view.getByTestId(TID.Modal.WhatsNew)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));

    expect(mockSaveLastSeenReleaseNotesVersion).toHaveBeenCalledWith(RELEASE_NOTES_VERSION);
    expect(mockPush).toHaveBeenCalledWith('/symbol-dictionary');
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
