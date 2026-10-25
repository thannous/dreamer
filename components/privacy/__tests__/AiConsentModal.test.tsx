import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native-legacy';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AiConsentModal, AiConsentModalHost } from '@/components/privacy/AiConsentModal';
import { hasAiConsent, requestAiConsent, resetAiConsentCacheForTests } from '@/lib/aiConsent';
import { TID } from '@/lib/testIDs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockOpenURL = jest.fn(() => Promise.resolve());

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
    Alert: { alert: () => undefined },
    findNodeHandle: () => 1,
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    Modal: MockModal,
    Platform: {
      OS: 'ios',
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
    Pressable: createNativeElement('Pressable'),
    StyleSheet: {
      absoluteFill: { position: 'absolute', inset: 0 },
      absoluteFillObject: { position: 'absolute', inset: 0 },
      create: <T,>(styles: T) => styles,
      flatten,
      hairlineWidth: 1,
    },
    Text: createNativeElement('Text'),
    View: createNativeElement('View'),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const AnimatedView = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('View', props, children);
  return {
    __esModule: true,
    default: {
      View: AnimatedView,
    },
    Easing: { bezier: () => undefined },
    cubicBezier: () => 'cubic-bezier(0.23, 1, 0.32, 1)',
  };
});

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Circle: () => null,
  Defs: () => null,
  Ellipse: () => null,
  LinearGradient: () => null,
  Path: () => null,
  RadialGradient: () => null,
  Stop: () => null,
}));

jest.mock('expo-blur', () => ({
  BlurView: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'dark',
    shadows: { xl: {} },
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { primary: '#fff', secondary: '#ccc', tertiary: '#888' },
    accent: { base: '#D4A574', strong: '#9A6332', soft: '#EAD4B4', text: '#EAD4B4' },
    surface: { raised: '#14131A', soft: '#222', border: '#333', borderStrong: '#444' },
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
  'ai_consent.title': 'Donner vie à ton rêve ?',
  'ai_consent.message': 'Pour explorer et illustrer ton rêve, Noctalia s’appuie sur une intelligence artificielle. Tes écrits restent privés et personnels.',
  'ai_consent.accept': 'Accepter et continuer',
  'ai_consent.decline': 'Pas maintenant',
  'settings.legal.privacyPolicy': 'Politique de confidentialité',
};

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLang: 'fr',
    t: (key: string) => copy[key] ?? key,
  }),
}));

describe('AiConsentModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetAiConsentCacheForTests();
    await AsyncStorage.clear();
  });

  it('renders the Noctalia modal with title, message, privacy policy link and actions', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const view = render(<AiConsentModal visible onAccept={onAccept} onDecline={onDecline} />);

    expect(view.getByText('Donner vie à ton rêve ?')).toBeTruthy();
    expect(
      view.getByText(
        'Pour explorer et illustrer ton rêve, Noctalia s’appuie sur une intelligence artificielle. Tes écrits restent privés et personnels.'
      )
    ).toBeTruthy();

    fireEvent.press(view.getByTestId(TID.Button.AiConsentPrivacyPolicy));
    expect(mockOpenURL).toHaveBeenCalledWith('https://noctalia.app/fr/politique-confidentialite/');

    fireEvent.press(view.getByTestId(TID.Button.AiConsentAccept));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByTestId(TID.Button.AiConsentDecline));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('connects requestAiConsent to AiConsentModalHost and persists acceptance', async () => {
    const view = render(<AiConsentModalHost />);

    let resolved: boolean | null = null;
    const promise = requestAiConsent((key) => copy[key] ?? key).then((res) => {
      resolved = res;
      return res;
    });

    await waitFor(() => expect(view.getByTestId(TID.Modal.AiConsent)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.AiConsentAccept));

    await expect(promise).resolves.toBe(true);
    expect(resolved).toBe(true);
    await expect(hasAiConsent()).resolves.toBe(true);
  });

  it('resolves false without granting when declined from AiConsentModalHost', async () => {
    const view = render(<AiConsentModalHost />);

    const promise = requestAiConsent((key) => copy[key] ?? key);

    await waitFor(() => expect(view.getByTestId(TID.Modal.AiConsent)).toBeTruthy());
    fireEvent.press(view.getByTestId(TID.Button.AiConsentDecline));

    await expect(promise).resolves.toBe(false);
    await expect(hasAiConsent()).resolves.toBe(false);
  });
});
