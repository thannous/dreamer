import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { reflowTabLabel, TabLabel, tabLabelMaxWidth } from '@/app/(drawer)/(tabs)/_layout';
import {
  accessibleMiniPlayerHeight,
  accessibleTabBarHeight,
  DrawerButtonClearance,
} from '@/hooks/useTabBarInset';

jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ children }: React.PropsWithChildren) => children, {
    Screen: () => null,
  }),
  useNavigation: () => ({ openDrawer: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('@/components/player/MiniPlayer', () => ({
  MiniPlayer: () => null,
}));

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({ session: null }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('accessible tab bar reflow', () => {
  const compact200Width = tabLabelMaxWidth(320, 4, true);

  it.each([
    [1, 52],
    [1.3, 66],
    [1.6, 79],
    [2, 96],
  ])('grows the compact bar at font scale %s', (fontScale, expectedHeight) => {
    expect(accessibleTabBarHeight(52, fontScale)).toBe(expectedHeight);
  });

  it('keeps the longest French label complete and scalable on one line', () => {
    render(
      <TabLabel compact fontScale={2} color="#fff" maxWidth={72} testID="tab.search.label">
        Rechercher
      </TabLabel>
    );

    const label = screen.getByTestId('tab.search.label', { includeHiddenElements: true });
    expect(label.props.allowFontScaling).toBe(true);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.5);
    expect(label.props.children).toBe('Rechercher');
    expect(label.props.style).toEqual(expect.objectContaining({ lineHeight: 24, width: 72 }));
  });

  it('keeps long unspaced labels complete instead of splitting them mid-word', () => {
    expect(reflowTabLabel('Rechercher', 1.3, 72)).toBe('Rechercher');
    expect(reflowTabLabel('Rechercher', 1.6, 72)).toBe('Rechercher');
    expect(reflowTabLabel('Respirer', 2, 72)).toBe('Respirer');
    expect(reflowTabLabel('Mon profil', 2, 48)).toBe('Mon\nprofil');
  });

  it('keeps Breathe complete on a 320dp / 200% compact bar instead of clipping the last letter', () => {
    expect(compact200Width).toBe(69);
    expect(reflowTabLabel('Breathe', 2, compact200Width)).toBe('Breathe');
    expect(reflowTabLabel('Breathe', 2, 200)).toBe('Breathe');
    expect(reflowTabLabel('Home', 2, compact200Width)).toBe('Home');
  });

  it('keeps the TalkBack name complete while the visual Breathe label stays whole', () => {
    render(
      <TabLabel
        compact
        fontScale={2}
        color="#fff"
        maxWidth={compact200Width}
        testID="tab.breathe.label">
        Breathe
      </TabLabel>
    );

    const label = screen.getByTestId('tab.breathe.label', { includeHiddenElements: true });
    expect(label.props.children).toBe('Breathe');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.accessibilityElementsHidden).toBe(true);
    expect(label.props.importantForAccessibility).toBe('no');
    expect(label.props.style).toEqual(expect.objectContaining({ width: compact200Width }));
  });

  it.each([
    [1, 57],
    [1.3, 81],
    [1.6, 105],
    [2, 137],
  ])('reserves a three-line mini-player at font scale %s', (fontScale, expectedHeight) => {
    expect(accessibleMiniPlayerHeight(57, fontScale)).toBe(expectedHeight);
  });

  it('keeps tab titles clear of the 48dp drawer button', () => {
    expect(DrawerButtonClearance).toBeGreaterThanOrEqual(48);
  });
});
