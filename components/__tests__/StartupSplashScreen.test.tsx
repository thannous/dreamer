import React from 'react';
import { cleanup, render } from '@testing-library/react-native-legacy';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import StartupSplashScreen from '@/components/StartupSplashScreen';

describe('Native startup splash', () => {
  afterEach(cleanup);

  it('finishes exactly once', () => {
    const onDone = jest.fn();
    const view = render(<StartupSplashScreen onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();

    view.rerender(<StartupSplashScreen done onDone={onDone} />);
    view.rerender(<StartupSplashScreen done onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
