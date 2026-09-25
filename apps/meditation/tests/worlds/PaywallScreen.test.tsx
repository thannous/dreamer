import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';

import PaywallScreen from '@/app/paywall';
import { en } from '@/lib/i18n/en';
import { fr } from '@/lib/i18n/fr';
import { TID } from '@/lib/testIDs';

let mockReason: string | string[] | undefined = 'premium-session';
let mockLanguage: 'en' | 'fr' = 'fr';
let mockIsPlus = false;
let mockRemainingPlays = 3;
const mockOffers = [
  { id: 'annual', priceLabel: '39,99 €', period: 'annual' as const, raw: null },
  { id: 'monthly', priceLabel: '5,99 €', period: 'monthly' as const, raw: null },
];

const mockEn = en;
const mockFr = fr;

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));

jest.mock('@/services/subscriptionService', () => ({
  listOffers: async () => mockOffers,
  purchase: async () => 'plus',
  restore: async () => 'free',
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ reason: mockReason }),
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: mockLanguage,
    setLanguage: async () => {},
    t: (key: keyof typeof en, values?: Record<string, string | number>) => {
      const catalogue = mockLanguage === 'fr' ? mockFr : mockEn;
      const template = catalogue[key] ?? mockEn[key] ?? String(key);
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match
      );
    },
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    isPlus: mockIsPlus,
    remainingPlays: mockRemainingPlays,
    applyTier: jest.fn(),
  }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

function mockViewport(fontScale = 1, width = 390, height = 844) {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    width,
    height,
    scale: 3,
    fontScale,
  });
}

function mockOpenUrl() {
  const openURL = jest.fn().mockResolvedValue(true);
  jest.spyOn(ReactNative.Linking, 'openURL').mockImplementation(openURL);
  return openURL;
}

async function renderPaywall() {
  render(<PaywallScreen />);
  await waitFor(() => expect(screen.getByTestId(TID.Button.PaywallBuy)).toBeTruthy());
}

describe('paywall commercial structure', () => {
  beforeEach(() => {
    mockReason = 'premium-session';
    mockLanguage = 'fr';
    mockIsPlus = false;
    mockRemainingPlays = 3;
    mockViewport();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never shows a raw i18n key, even for the old session alias', async () => {
    mockReason = 'session';
    await renderPaywall();

    expect(screen.queryByText(/paywall\.reason/)).toBeNull();
    expect(
      screen.getByText('Cette séance appartient à Noctalia Plus. Ce n’est pas une pratique gratuite.')
    ).toBeTruthy();
  });

  it('uses distinct copy for a Plus session and a spent monthly quota', async () => {
    await renderPaywall();
    expect(
      screen.getByText('Cette séance appartient à Noctalia Plus. Ce n’est pas une pratique gratuite.')
    ).toBeTruthy();

    mockReason = 'monthly-quota';
    mockRemainingPlays = 0;
    const quota = render(<PaywallScreen />);
    await waitFor(() => expect(quota.getByTestId(TID.Button.PaywallBuy)).toBeTruthy());
    expect(
      quota.getByText('Vous avez déjà utilisé vos trois séances gratuites de ce mois.')
    ).toBeTruthy();
    expect(
      quota.queryByText('Cette séance appartient à Noctalia Plus. Ce n’est pas une pratique gratuite.')
    ).toBeNull();
  });

  it('falls back to a localized sentence when the reason is unknown', async () => {
    mockReason = 'paywall.reason.session';
    await renderPaywall();

    expect(screen.queryByText('paywall.reason.session')).toBeNull();
    expect(screen.getByText('Noctalia Plus débloque cette pratique.')).toBeTruthy();
  });

  it.each(['premium-session', 'monthly-quota'] as const)(
    'keeps the same commercial structure for %s',
    async (reason) => {
      mockReason = reason;
      mockRemainingPlays = reason === 'monthly-quota' ? 0 : 3;
      await renderPaywall();

      expect(screen.getByText('Essayer 7 jours gratuitement')).toBeTruthy();
      expect(screen.getByText('7 jours offerts, puis 39,99 €')).toBeTruthy();
      expect(
        screen.getByText(
          'Essai gratuit de 7 jours, puis 39,99 € par an. Renouvellement automatique jusqu’à résiliation.'
        )
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Renouvellement automatique. Annulez à tout moment dans Google Play ou l’App Store.'
        )
      ).toBeTruthy();
      expect(screen.getByText('Pas maintenant')).toBeTruthy();
      expect(screen.getByTestId(TID.Button.PaywallRestore)).toBeTruthy();
      expect(screen.getByText('Conditions d’utilisation')).toBeTruthy();
      expect(screen.getByText('Politique de confidentialité')).toBeTruthy();
    }
  );

  it('opens terms and privacy as two distinct links', async () => {
    const openURL = mockOpenUrl();
    await renderPaywall();

    const terms = screen.getByTestId('paywall.legal.terms');
    const privacy = screen.getByTestId('paywall.legal.privacy');
    expect(terms.props.accessibilityRole).toBe('link');
    expect(privacy.props.accessibilityRole).toBe('link');
    expect(terms.props.accessibilityLabel).toBe('Conditions d’utilisation');
    expect(privacy.props.accessibilityLabel).toBe('Politique de confidentialité');
    expect(screen.getByText('Conditions d’utilisation')).toBeTruthy();
    expect(screen.getByText('Politique de confidentialité')).toBeTruthy();
    expect(screen.queryByText('Conditions · Confidentialité')).toBeNull();
    expect(screen.queryByTestId('paywall.legal')).toBeNull();

    fireEvent.press(terms);
    fireEvent.press(privacy);
    expect(openURL).toHaveBeenNthCalledWith(1, 'https://noctalia.app/terms');
    expect(openURL).toHaveBeenNthCalledWith(2, 'https://noctalia.app/privacy');
  });
});
