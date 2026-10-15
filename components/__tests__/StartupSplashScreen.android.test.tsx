import React from 'react';
import { cleanup, render } from '@testing-library/react-native-legacy';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import StartupSplashScreen, {
  STARTUP_SPLASH_MINIMUM_VISIBLE_MS,
} from '@/components/StartupSplashScreen.android';

describe('Android startup splash', () => {
  afterEach(cleanup);

  it('holds the native bitmap for no more than the static budget', () => {
    expect(STARTUP_SPLASH_MINIMUM_VISIBLE_MS).toBeLessThanOrEqual(150);
  });

  it('finishes exactly once', () => {
    const onDone = jest.fn();
    const view = render(<StartupSplashScreen onDone={onDone} />);

    view.rerender(<StartupSplashScreen done onDone={onDone} />);
    view.rerender(<StartupSplashScreen done onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
