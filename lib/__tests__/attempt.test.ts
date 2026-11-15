import { attempt, whileHeld } from '@/lib/attempt';

describe('attempt', () => {
  it('returns what the task returns and runs finally last', async () => {
    const order: string[] = [];
    const result = await attempt(async () => { order.push('task'); return 3; }, {
      finally: () => { order.push('finally'); },
    });
    expect(result).toBe(3);
    expect(order).toEqual(['task', 'finally']);
  });

  it('answers with catch in place of a task that threw', async () => {
    const error = new Error('no');
    const seen: unknown[] = [];
    const result = await attempt<string>(() => { throw error; }, {
      catch: (caught) => { seen.push(caught); return 'instead'; },
      finally: () => { seen.push('finally'); },
    });
    expect(result).toBe('instead');
    expect(seen).toEqual([error, 'finally']);
  });

  it('lets the error go on to the caller without a catch, after finally', async () => {
    const done = jest.fn();
    await expect(attempt(async () => { throw new Error('through'); }, { finally: done })).rejects.toThrow('through');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts the task before returning, as a try block would', () => {
    const started = jest.fn();
    void attempt(started, {});
    expect(started).toHaveBeenCalledTimes(1);
  });
});

describe('whileHeld', () => {
  it('holds the flag while the task runs and lowers it before finally', async () => {
    const flag = { current: false };
    const seen: boolean[] = [];
    let release!: () => void;
    const running = whileHeld(flag, () => new Promise<void>((resolve) => { release = resolve; }), {
      finally: () => { seen.push(flag.current); },
    });
    expect(flag.current).toBe(true);
    release();
    await running;
    expect(flag.current).toBe(false);
    expect(seen).toEqual([false]);
  });

  it('lowers the flag when the task throws, with or without a catch', async () => {
    const flag = { current: false };
    await expect(whileHeld(flag, async () => { throw new Error('failed'); })).rejects.toThrow('failed');
    expect(flag.current).toBe(false);

    const result = await whileHeld(flag, async (): Promise<boolean> => { throw new Error('failed'); }, {
      catch: () => false,
    });
    expect(result).toBe(false);
    expect(flag.current).toBe(false);
  });
});
