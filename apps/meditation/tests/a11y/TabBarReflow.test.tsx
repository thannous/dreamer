import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { reflowTabLabel, TabLabel, tabLabelMaxWidth } from '@/app/(drawer)/(tabs)/_layout';
import { accessibleTabBarHeight, DrawerButtonClearance } from '@/hooks/useTabBarInset';

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

  it('keeps the longest French label scalable and able to wrap', () => {
    render(
      <TabLabel compact fontScale={2} color="#fff" maxWidth={72} testID="tab.search.label">
        Rechercher
      </TabLabel>
    );

    const label = screen.getByTestId('tab.search.label', { includeHiddenElements: true });
    expect(label.props.allowFontScaling).toBe(true);
    expect(label.props.numberOfLines).toBe(2);
    expect(label.props.children).toBe('Reche\nrcher');
    expect(label.props.style).toEqual(expect.objectContaining({ lineHeight: 24, width: 72 }));
  });

  it('inserts an explicit visual break into long unspaced labels at large scale', () => {
    expect(reflowTabLabel('Rechercher', 1.3, 72)).toBe('Rechercher');
    expect(reflowTabLabel('Rechercher', 1.6, 72)).toBe('Reche\nrcher');
    expect(reflowTabLabel('Respirer', 2, 72)).toBe('Resp\nirer');
  });

  it('wraps Breathe on a 320dp / 200% compact bar instead of clipping the last letter', () => {
    expect(compact200Width).toBe(69);
    expect(reflowTabLabel('Breathe', 2, compact200Width)).toBe('Brea\nthe');
    expect(reflowTabLabel('Breathe', 2, 200)).toBe('Breathe');
    expect(reflowTabLabel('Home', 2, compact200Width)).toBe('Home');
  });

  it('keeps the TalkBack name complete while the visual Breathe label wraps', () => {
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
    expect(label.props.children).toBe('Brea\nthe');
    expect(label.props.accessibilityElementsHidden).toBe(true);
    expect(label.props.importantForAccessibility).toBe('no');
    expect(label.props.style).toEqual(expect.objectContaining({ width: compact200Width }));
  });

  it('keeps tab titles clear of the 48dp drawer button', () => {
    expect(DrawerButtonClearance).toBeGreaterThanOrEqual(48);
  });
});
