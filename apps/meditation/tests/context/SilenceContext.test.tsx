import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { ProgressiveSilence } from '@/components/atmosphere/ProgressiveSilence';
import { SilenceDelayMs } from '@/constants/motion';
import { SilenceProvider } from '@/context/SilenceContext';
import { TID } from '@/lib/testIDs';

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

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('progressive silence', () => {
  it('leaves the chrome alone until the delay has passed', () => {
    renderScreen();

    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
  });

  it('covers the whole screen once the chrome has withdrawn, not just the chrome', () => {
    renderScreen();
    letTheChromeWithdraw();

    // One catcher for the screen. Two would mean each piece of chrome is back
    // to catching only its own touches, which is the bug this replaced.
    expect(screen.getAllByTestId(TID.Button.RevealControls)).toHaveLength(1);
  });

  it('brings every piece back together on a touch outside all of them', () => {
    renderScreen();
    letTheChromeWithdraw();

    fireEvent.press(screen.getByTestId(TID.Button.RevealControls));

    // The catcher only exists while the chrome is hidden: its absence is the
    // assertion that both halves came back, and came back at the same time.
    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
    expect(screen.getByTestId('chrome.top')).toBeTruthy();
    expect(screen.getByTestId('chrome.bottom')).toBeTruthy();
  });

  it('never withdraws while the screen is inactive', () => {
    renderScreen(false);
    letTheChromeWithdraw();

    expect(screen.queryByTestId(TID.Button.RevealControls)).toBeNull();
  });
});
