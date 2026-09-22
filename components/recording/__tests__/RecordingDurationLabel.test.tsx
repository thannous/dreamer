/** @jest-environment jsdom */
import React from 'react';
import { act, render } from '@testing-library/react';
import { RecordingDurationLabel } from '../RecordingDurationLabel';

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (_key: string, params: { duration: string }) => params.duration }),
}));

it('updates elapsed time without rendering its parent and releases the timer on unmount', () => {
  jest.useFakeTimers();
  jest.setSystemTime(100_000);
  const startedAtRef = { current: 39_000 as number | null };
  let parentRenders = 0;
  function Parent() {
    parentRenders++;
    return <RecordingDurationLabel startedAtRef={startedAtRef} />;
  }
  const view = render(<Parent />);
  try {
    expect(view.container.textContent).toBe('1:01');
    act(() => { jest.advanceTimersByTime(5000); });
    expect(view.container.textContent).toBe('1:06');
    expect(parentRenders).toBe(1);
    // The session can reset or restart without replacing the ref object.
    startedAtRef.current = null;
    act(() => { jest.advanceTimersByTime(1000); });
    expect(view.container.textContent).toBe('0:00');
    startedAtRef.current = Date.now();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(view.container.textContent).toBe('0:02');
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});
