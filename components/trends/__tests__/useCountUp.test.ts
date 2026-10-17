/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useCountUp } from '../useCountUp';

// The web journey cannot switch reduced motion on and off mid-session; this is that path.
describe('useCountUp', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the latest value once reduced motion is turned off again', () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target, still }) => useCountUp(target, { fromZero: false, still }),
      { initialProps: { target: 8, still: true } },
    );

    // A period change while motion is reduced: the value is there at once.
    rerender({ target: 4, still: true });
    expect(result.current).toBe(4);

    rerender({ target: 4, still: false });
    act(() => {
      jest.runAllTimers();
    });
    expect(result.current).toBe(4);
  });
});
