/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

it.each(['android', 'web'] as const)('fills the bounded wide %s wrapper only when requested', platform => {
  mockPlatformOS = platform;
  mockWindowWidth = 1280;
  const { rerender } = render(<ScreenContainer testID="bounded" style={{ flex: 1 }} fillContent>Content</ScreenContainer>);
  const outer = screen.getByTestId('bounded');
  expect(outer.getAttribute('data-native-style')).toContain('"flex":1');
  expect(outer.firstElementChild?.getAttribute('data-native-style')).toContain('"flex":1');
  rerender(<ScreenContainer testID="bounded" style={{ flex: 1 }}>Content</ScreenContainer>);
  expect(outer.firstElementChild?.getAttribute('data-native-style')).not.toContain('"flex":1');
});
it('keeps a bounded wrapper in the narrow layout', () => {
  mockPlatformOS = 'android';
  mockWindowWidth = 390;
  render(<ScreenContainer testID="bounded" style={{ flex: 1 }} fillContent>Content</ScreenContainer>);
  const outer = screen.getByTestId('bounded');
  expect(outer.getAttribute('data-native-style')).toContain('"flex":1');
  expect(outer.firstElementChild?.getAttribute('data-native-style')).toContain('"flex":1');
});

it('preserves child state and mount across wide and narrow bounded layouts', () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  function StatefulChild() {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => { mounted(); return unmounted; }, []);
    return <button onClick={() => setCount(count + 1)}>Draft {count}</button>;
  }
  mockPlatformOS = 'android';
  mockWindowWidth = 390;
  const tree = <ScreenContainer fillContent><StatefulChild /></ScreenContainer>;
  const { rerender } = render(tree);
  fireEvent.click(screen.getByText('Draft 0'));
  for (const width of [840, 390, 1280]) {
    mockWindowWidth = width;
    rerender(<ScreenContainer fillContent><StatefulChild /></ScreenContainer>);
    expect(screen.getByText('Draft 1')).toBeTruthy();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }
});
