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
