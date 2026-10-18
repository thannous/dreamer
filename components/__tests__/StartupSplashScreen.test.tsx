import React from 'react';
import { cleanup, render } from '@testing-library/react-native-legacy';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import StartupSplashScreen, {
  STARTUP_SPLASH_MINIMUM_VISIBLE_MS,
} from '@/components/StartupSplashScreen';

describe('Native startup splash', () => {
  afterEach(cleanup);

  // Owner decision 2026-10-17: the 150 ms floor read as a flash on iPhone.
  it('holds the native splash long enough to be seen', () => {
    expect(STARTUP_SPLASH_MINIMUM_VISIBLE_MS).toBe(1500);
  });

  it('finishes exactly once', () => {
    const onDone = jest.fn();
    const view = render(<StartupSplashScreen onDone={onDone} />);

    view.rerender(<StartupSplashScreen done onDone={onDone} />);
    view.rerender(<StartupSplashScreen done onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
