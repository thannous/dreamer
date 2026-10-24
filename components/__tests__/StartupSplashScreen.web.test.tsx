import React from 'react';
import { cleanup, render } from '@testing-library/react-native-legacy';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import StartupSplashScreen from '../StartupSplashScreen.web';

// Web only: iOS and Android hold the native splash (StartupSplashScreen.tsx).
// The root marks startup interactive after this cover is removed and painted.
describe('Startup splash', () => {
  afterEach(cleanup);

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
