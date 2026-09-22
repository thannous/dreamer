import { createStreamingTextPublisher } from '../streamingTextPublisher';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('publishes the first fragment immediately, bounds bursts, and flushes the authoritative final text', () => {
  const publish = jest.fn();
  const stream = createStreamingTextPublisher(publish);
  stream.push('a');
  expect(publish.mock.calls).toEqual([['a']]);
  for (let length = 2; length <= 100; length += 1) stream.push('a'.repeat(length));
  jest.advanceTimersByTime(49);
  expect(publish).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(publish).toHaveBeenLastCalledWith('a'.repeat(100));
  stream.push('another partial');
  stream.flush('complete response');
  stream.dispose();
  jest.runAllTimers();
  expect(publish.mock.calls).toEqual([['a'], ['a'.repeat(100)], ['complete response']]);
});

it('never publishes queued fragments after cancellation, error, or disposal', () => {
  const publish = jest.fn();
  const stream = createStreamingTextPublisher(publish);
  stream.push('first');
  stream.push('pending');
  stream.dispose();
  stream.push('late');
  stream.flush('late final');
  jest.runAllTimers();
  expect(publish.mock.calls).toEqual([['first']]);
  expect(jest.getTimerCount()).toBe(0);
});

it('does not delay isolated fragments or publish a duplicate final response', () => {
  const publish = jest.fn();
  const stream = createStreamingTextPublisher(publish);
  stream.push('first');
  jest.advanceTimersByTime(75);
  stream.push('complete');
  expect(publish.mock.calls).toEqual([['first'], ['complete']]);
  stream.flush('complete');
  expect(publish).toHaveBeenCalledTimes(2);
  stream.dispose();
});
