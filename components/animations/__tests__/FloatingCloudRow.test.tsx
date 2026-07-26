/* @jest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { FloatingCloudRow } from '@/components/animations/FloatingCloudRow';

let mockWindowWidth = 390;
let mockUpdateWindowWidth: (width: number) => void = () => {};

jest.mock('react-native', () => {
  const React = require('react');

  return {
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    useWindowDimensions: () => {
      const [width, setWidth] = React.useState(mockWindowWidth);
      mockUpdateWindowWidth = (nextWidth: number) => {
        mockWindowWidth = nextWidth;
        setWidth(nextWidth);
      };
      return { width, height: 844, scale: 1, fontScale: 1 };
    },
  };
});

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    atmosphere: { horizon: '#horizon' },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/lib/moti', () => ({
  MotiView: ({
    animate,
    children,
    from,
  }: {
    animate: unknown;
    children?: React.ReactNode;
    from: unknown;
  }) => (
    <div
      data-animate={JSON.stringify(animate)}
      data-from={JSON.stringify(from)}
      data-testid="floating-cloud-row"
    >
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  mockWindowWidth = 390;
});

describe('FloatingCloudRow', () => {
  it('updates its travel distance after the window is resized', () => {
    render(<FloatingCloudRow top={20} />);

    expect(screen.getByTestId('floating-cloud-row').getAttribute('data-from')).toContain(
      '"translateX":-610'
    );
    expect(screen.getByTestId('floating-cloud-row').getAttribute('data-animate')).toContain(
      '"translateX":610'
    );

    act(() => mockUpdateWindowWidth(1200));

    expect(screen.getByTestId('floating-cloud-row').getAttribute('data-from')).toContain(
      '"translateX":-1420'
    );
    expect(screen.getByTestId('floating-cloud-row').getAttribute('data-animate')).toContain(
      '"translateX":1420'
    );
  });
});
