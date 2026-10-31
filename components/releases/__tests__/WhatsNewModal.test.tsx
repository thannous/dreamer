import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native-legacy';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  RELEASE_NOTES_VERSION,
  WhatsNewModal,
  WhatsNewModalHost,
} from '@/components/releases/WhatsNewModal';
import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';
import { TID } from '@/lib/testIDs';

const mockNavigate = jest.fn();
type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;
const mockGetLastSeenReleaseNotesVersion = typedJestFn<() => Promise<string | null>>();
const mockSaveLastSeenReleaseNotesVersion = typedJestFn<
  (version: string) => Promise<void>
>();

let mockMode: 'light' | 'dark' = 'dark';
let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';
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
      get OS() {
        return mockPlatformOS;
      },
      select: (values: Record<string, unknown>) => values[mockPlatformOS] ?? values.default,
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
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
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
  "release_notes.title": "Noctalia {version} est là",
  "release_notes.subtitle": "Voici ce qui change dans l’app.",
  "release_notes.journal.title": "Tes rêves en images",
  "release_notes.journal.body": "Chaque rêve s’affiche avec sa grande image. Tu peux aussi y ajouter une note ou le partager.",
  "release_notes.widgets.title": "Noctalia sur ton écran",
  "release_notes.widgets.body": "Ajoute Noctalia à ton écran d’accueil ou à ton écran verrouillé pour noter un rêve plus vite.",
  "release_notes.today.title": "Un accueil plus clair",
  "release_notes.full_moon.title": "La pleine lune",
  "release_notes.sky.title": "Tes rêves en étoiles",
  "release_notes.symbols.title": "240 symboles expliqués",
  "release_notes.collection.title": "Des cartes à gagner",
  "release_notes.primary": "Voir mon journal",
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
    mockPlatformOS = 'ios';
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
    expect(view.getByText(`Noctalia ${RELEASE_NOTES_VERSION.split('.').slice(0, 2).join('.')} est là`)).toBeTruthy();
    expect(view.getByText('Tes rêves en images')).toBeTruthy();
    expect(view.getByText('Un accueil plus clair')).toBeTruthy();
    expect(view.getByText('La pleine lune')).toBeTruthy();
    expect(view.getByText('Tes rêves en étoiles')).toBeTruthy();
    expect(view.getByText('240 symboles expliqués')).toBeTruthy();
    expect(view.getByText('Des cartes à gagner')).toBeTruthy();
    expect(view.getByText('Noctalia sur ton écran')).toBeTruthy();
    expect(
      view.getByText(
        'Ajoute Noctalia à ton écran d’accueil ou à ton écran verrouillé pour noter un rêve plus vite.'
      )
    ).toBeTruthy();

    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewLater));
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewClose));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('names the current release series in every language title', () => {
    const series = RELEASE_NOTES_VERSION.split('.').slice(0, 2).join('.');
    for (const pack of [de, en, es, fr, italian, pt]) {
      const title = pack['release_notes.title'].replace('{version}', series);
      expect(title).toContain(`Noctalia ${series}`);
      expect(title.match(/\d+\.\d+/g)).toEqual([series]);
    }
  });

  it('leaves the iPhone widgets out where the build has none', () => {
    mockPlatformOS = 'android';
    const view = render(<WhatsNewModal visible onClose={jest.fn()} onPrimary={jest.fn()} />);

    expect(view.getByText('Des cartes à gagner')).toBeTruthy();
    expect(view.queryByText('Noctalia sur ton écran')).toBeNull();
  });

  it('shows once after onboarding and persists the version before opening the journal', async () => {
    const view = render(<WhatsNewModalHost ready />);

    await waitFor(() => expect(view.getByTestId(TID.Modal.WhatsNew)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.WhatsNewPrimary));

    expect(mockSaveLastSeenReleaseNotesVersion).toHaveBeenCalledWith(RELEASE_NOTES_VERSION);
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/journal');
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
