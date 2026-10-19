import { isPerformanceTracingEnabled } from '@/lib/env';
import { recordPerformanceEvent } from '@/lib/observe';
import { markPerformance, markPerformanceAfterFrames } from '@/lib/performanceTrace';

jest.mock('@/lib/env', () => ({ isPerformanceTracingEnabled: jest.fn(() => true) }));
jest.mock('@/lib/observe', () => ({ recordPerformanceEvent: jest.fn() }));

// Browser/native journeys cannot inspect the opt-in Observe payload or a canceled
// off-screen callback. These controls cover privacy and stale timing attribution.
describe('performance diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(isPerformanceTracingEnabled).mockReturnValue(true);
    jest.mocked(recordPerformanceEvent).mockClear();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    global.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 16) as unknown as number;
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('exports only finite numeric values and flags, without text, IDs or URLs', () => {
    markPerformance('image.source_resolved', { trace: 7, cached: true, uri: 'https://private.example/person/dream', request: 'private-id', invalid: Infinity });
    expect(recordPerformanceEvent).toHaveBeenCalledWith('image.source_resolved', {
      elapsed_ms: expect.any(Number), trace: 7, cached: true,
    });
  });

  it('records nothing and schedules no work when diagnostics are off', () => {
    jest.mocked(isPerformanceTracingEnabled).mockReturnValue(false);
    markPerformance('journal.save_acknowledged');
    markPerformanceAfterFrames('analysis.reveal_window_elapsed');
    jest.runAllTimers();
    expect(recordPerformanceEvent).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('cancels a reveal marker when its screen leaves before the next frame', () => {
    const cancel = markPerformanceAfterFrames('analysis.reveal_window_elapsed', { trace: 1 }, 120);
    jest.advanceTimersByTime(136);
    cancel();
    jest.runAllTimers();
    expect(recordPerformanceEvent).not.toHaveBeenCalled();
  });
});
