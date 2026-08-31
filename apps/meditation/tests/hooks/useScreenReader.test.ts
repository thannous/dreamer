import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useScreenReader } from '@/hooks/useScreenReader';

describe('useScreenReader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the last known enabled state while a remount refreshes it', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    const addScreenReaderListener = ((
      event: string,
      callback: (enabled: boolean) => void
    ) => {
      if (event === 'screenReaderChanged') listener = callback;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener;
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(addScreenReaderListener);
    const enabledCheck = jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValueOnce(true);

    const first = renderHook(() => useScreenReader());
    await waitFor(() => expect(first.result.current).toBe(true));
    first.unmount();

    enabledCheck.mockImplementationOnce(() => new Promise(() => {}));
    const second = renderHook(() => useScreenReader());
    expect(second.result.current).toBe(true);

    act(() => listener?.(false));
    expect(second.result.current).toBe(false);
  });
});
