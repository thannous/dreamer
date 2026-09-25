import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { ProgressiveSilence } from '@/components/atmosphere/ProgressiveSilence';
import { SilenceDelayMs } from '@/constants/motion';
import { SilenceProvider } from '@/context/SilenceContext';
import { TID } from '@/lib/testIDs';

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/hooks/useScreenReader', () => ({
  useScreenReader: () => false,
}));

/**
 * Progressive silence is the interaction signature, and its failure mode is the
 * worst one the app has: chrome that withdraws and never comes back leaves the
 * player with no controls and no visible way out.
 *
 * That is exactly what shipped — each piece of chrome held its own schedule and
 * its own touch catcher sized to its own bounds, so the artwork in between woke
 * nothing and the two halves fell out of step. These lock the contract that
 * replaced it: one schedule for the screen, one catcher over all of it.
 */
const renderScreen = (active = true) =>
  render(
    <SilenceProvider active={active}>
      <ProgressiveSilence>
        <View testID="chrome.top" />
      </ProgressiveSilence>
      <View testID="artwork" />
      <ProgressiveSilence>
        <View testID="chrome.bottom" />
      </ProgressiveSilence>
    </SilenceProvider>
  );

const letTheChromeWithdraw = () => {
  act(() => {
    jest.advanceTimersByTime(SilenceDelayMs + 1);
  });
};

const chromeOpacity = () => {
  let node: ReactTestInstance | null = screen.getByTestId('chrome.top', {
    includeHiddenElements: true,
  });

  while (node) {
    const style = StyleSheet.flatten(node.props.style);
    if (style?.transitionProperty === 'opacity') return style.opacity;
    node = node.parent;
  }

  return undefined;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('progressive silence', () => {
  it('leaves the chrome alone until the delay has passed', () => {
    renderScreen();

    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
  });

  it('never withdraws while the screen is inactive', () => {
    renderScreen(false);
    letTheChromeWithdraw();

    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
  });

  it('restores the rendered chrome when native playback becomes inactive', () => {
    const view = renderScreen();
    letTheChromeWithdraw();
    expect(chromeOpacity()).toBe(0);

    view.rerender(
      <SilenceProvider active={false}>
        <ProgressiveSilence>
          <View testID="chrome.top" />
        </ProgressiveSilence>
        <View testID="artwork" />
        <ProgressiveSilence>
          <View testID="chrome.bottom" />
        </ProgressiveSilence>
      </SilenceProvider>
    );

    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
    expect(chromeOpacity()).toBe(1);
  });
});
