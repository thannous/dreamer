import { scheduleAfterStartupPaint } from '@/lib/startupPaint';

describe('scheduleAfterStartupPaint', () => {
  it('waits for two animation frames before revealing the destination', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = jest.fn((callback: FrameRequestCallback) => {
      const handle = callbacks.size + 1;
      callbacks.set(handle, callback);
      return handle;
    });
    const cancelFrame = jest.fn();
    const onPainted = jest.fn();

    scheduleAfterStartupPaint(onPainted, requestFrame, cancelFrame);

    callbacks.get(1)?.(0);
    expect(onPainted).not.toHaveBeenCalled();

    callbacks.get(2)?.(16);
    expect(onPainted).toHaveBeenCalledTimes(1);
  });

  it('cancels both scheduled frames when disposed after the first frame', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = jest.fn((callback: FrameRequestCallback) => {
      const handle = callbacks.size + 1;
      callbacks.set(handle, callback);
      return handle;
    });
    const cancelFrame = jest.fn();
    const onPainted = jest.fn();
    const dispose = scheduleAfterStartupPaint(onPainted, requestFrame, cancelFrame);

    callbacks.get(1)?.(0);
    dispose();
    callbacks.get(2)?.(16);

    expect(cancelFrame).toHaveBeenCalledWith(1);
    expect(cancelFrame).toHaveBeenCalledWith(2);
    expect(onPainted).not.toHaveBeenCalled();
  });
});
