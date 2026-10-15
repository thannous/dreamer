import React from 'react';
import { cleanup, render } from '@testing-library/react-native-legacy';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import StartupSplashScreen, {
  STARTUP_SPLASH_MINIMUM_VISIBLE_MS,
} from '@/components/StartupSplashScreen';

// `startup.interactive` is marked by `onDone`: once per launch.
describe('Startup splash', () => {
  afterEach(cleanup);

  it('holds a still splash for no more than the static budget', () => {
    expect(STARTUP_SPLASH_MINIMUM_VISIBLE_MS).toBeLessThanOrEqual(150);
  });

  it('finishes exactly once when the first screen is ready', () => {
    const onDone = jest.fn();
    const view = render(<StartupSplashScreen onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();

    view.rerender(<StartupSplashScreen done onDone={onDone} />);
    view.rerender(<StartupSplashScreen done onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not finish a splash removed before the first screen is ready', () => {
    const onDone = jest.fn();
    const view = render(<StartupSplashScreen onDone={onDone} />);

    view.unmount();

    expect(onDone).not.toHaveBeenCalled();
  });
});
