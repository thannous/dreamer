/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { StatsLockedSection, StatsNotEnoughData } from '@/components/stats/StatsLockedSection';

// `jest.mock`, not `jest.doMock`: both components are static imports here (same shape as
// components/chat/__tests__/Composer.test.tsx). `@/constants/journalTheme` and
// `@/constants/noctaliaDesign` are plain data and stay real on purpose.
jest.mock('react-native', () => {
  const React = require('react');

  const flatten = (style: any): Record<string, any> => {
    if (!style) return {};
    if (Array.isArray(style)) {
      return style.reduce((acc: Record<string, any>, item: any) => ({ ...acc, ...flatten(item) }), {});
    }
    return style as Record<string, any>;
  };

  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessible,
      accessibilityRole,
      accessibilityLabel,
      accessibilityElementsHidden,
      importantForAccessibility,
      style,
      ...rest
    } = props;
    const flat = flatten(typeof style === 'function' ? style({ pressed: false }) : style);
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      // The clamped bar width is the only style value these tests assert on; exposing it
      // as an attribute keeps the assertion readable and the mock dumb.
      ...(flat.width !== undefined ? { 'data-width': String(flat.width) } : {}),
    };
  };

  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    Text: createElement('span'),
    View: createElement('div'),
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    fraunces: { regular: 'f', medium: 'f', semiBold: 'f', bold: 'f' },
    spaceGrotesk: { regular: 's', medium: 's', semiBold: 's', bold: 's' },
  },
}));

const noctalia = {
  surface: { soft: '#111', border: '#222', borderStrong: '#333' },
  text: { primary: '#eee', secondary: '#ccc', tertiary: '#999' },
  accent: { base: '#a0f', text: '#a0f'},
} as unknown as NoctaliaDesignTokens;

afterEach(() => {
  cleanup();
});

const renderLocked = (overrides: Partial<React.ComponentProps<typeof StatsLockedSection>> = {}) => {
  const onPress = jest.fn();
  render(
    <StatsLockedSection
      noctalia={noctalia}
      countLabel="2 families"
      bodyLabel="Plus names them"
      ctaLabel="Unlock"
      previewRows={[{ id: 'a', ratio: 1 }]}
      onPress={onPress}
      testID="t"
      ctaTestID="c"
      {...overrides}
    />,
  );
  return { onPress };
};

describe('StatsLockedSection', () => {
  it('[B] Given a count, a body and a CTA When the locked section renders Then all three are shown and the CTA is a labelled button', () => {
    renderLocked();

    expect(screen.getByText('2 families')).toBeTruthy();
    expect(screen.getByText('Plus names them')).toBeTruthy();

    const cta = screen.getByTestId('c');
    // REVERT: drop `accessibilityRole="button"` or `accessibilityLabel` from the Pressable.
    expect(cta.getAttribute('role')).toBe('button');
    expect(cta.getAttribute('aria-label')).toBe('Unlock');
  });

  it('[B] Given an out-of-range ratio When a preview bar renders Then it is clamped', () => {
    renderLocked({
      previewRows: [
        { id: 'a', ratio: 0 },
        { id: 'b', ratio: 5 },
        { id: 'c', ratio: 0.5 },
      ],
    });

    const widths = Array.from(screen.getByTestId('t').querySelectorAll('[data-width]')).map((node) =>
      node.getAttribute('data-width'),
    );
    // REVERT: delete `clampRatio` -> '0%' and '500%'. A 0% bar is invisible and a 500% bar
    // overflows the card; both are silent in every screen-level test because the call site
    // never produces them.
    expect(widths).toEqual(['12%', '100%', '50%']);
  });

  it('[B] Given the CTA When it is pressed Then onPress fires exactly once', () => {
    const { onPress } = renderLocked();

    fireEvent.click(screen.getByTestId('c'));

    // REVERT: also attach onPress to the outer card -> the click bubbles and fires twice.
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StatsNotEnoughData', () => {
  it('[B] Given a not-enough card When it renders Then its accessible name joins the title and the body', () => {
    render(<StatsNotEnoughData noctalia={noctalia} title="Title" body="Body" testID="t" />);

    // REVERT: drop the `accessible` + composed accessibilityLabel. It is the only text
    // alternative this state has.
    expect(screen.getByTestId('t').getAttribute('aria-label')).toBe('Title. Body');
  });
});
