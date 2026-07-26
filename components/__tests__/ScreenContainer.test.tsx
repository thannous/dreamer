/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { ScreenContainer } from '@/components/ScreenContainer';

let mockPlatformOS: 'android' | 'ios' | 'web' = 'web';
let mockWindowWidth = 390;

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    View: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => (
      <div data-native-style={JSON.stringify(style)} data-testid={testID}>
        {children}
      </div>
    ),
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: 844,
      scale: 1,
      fontScale: 1,
    }),
  };
});

afterEach(() => {
  cleanup();
  mockPlatformOS = 'web';
  mockWindowWidth = 390;
});

describe('ScreenContainer', () => {
  it('constrains content on a wide Android window', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 840;

    render(
      <ScreenContainer
        maxWidth={960}
        desktopPaddingHorizontal={40}
        testID="screen-container"
      >
        Content
      </ScreenContainer>
    );

    const inner = screen.getByTestId('screen-container').firstElementChild;
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute('data-native-style')).toContain('"maxWidth":960');
    expect(inner?.getAttribute('data-native-style')).toContain('"paddingHorizontal":40');
  });

  it('preserves the constrained desktop Web layout', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 1280;

    render(<ScreenContainer testID="screen-container">Content</ScreenContainer>);

    expect(screen.getByTestId('screen-container').firstElementChild).not.toBeNull();
  });

  it('does not add a nested constraint below the wide breakpoint', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 599;

    render(<ScreenContainer testID="screen-container">Content</ScreenContainer>);

    expect(screen.getByTestId('screen-container').firstElementChild).toBeNull();
  });
});
