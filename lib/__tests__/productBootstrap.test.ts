import { runProductBootstrap, scheduleProductBootstrap } from '@/lib/productBootstrap';

function dependencies() {
  return {
    guestSession: jest.fn(),
    googleSignIn: jest.fn(),
    guestAnalysisMigration: jest.fn(),
    guestDreamMigration: jest.fn(),
  };
}

describe('product bootstrap', () => {
  it('starts Journal guest initialization and both migrations with shared auth', async () => {
    const actions = dependencies();
    await runProductBootstrap('journal', jest.fn(), actions);
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledTimes(1));
  });

  it('does not invoke any guest loader for Lucid', async () => {
    const actions = dependencies();
    await runProductBootstrap('lucid', jest.fn(), actions);
    expect(actions.googleSignIn).toHaveBeenCalledTimes(1);
    expect(actions.guestSession).not.toHaveBeenCalled();
    expect(actions.guestAnalysisMigration).not.toHaveBeenCalled();
    expect(actions.guestDreamMigration).not.toHaveBeenCalled();
  });

  it('isolates synchronous and asynchronous failures without suppressing other actions', async () => {
    const actions = dependencies();
    const syncError = new Error('session');
    const asyncError = new Error('auth');
    actions.guestSession.mockImplementation(() => { throw syncError; });
    actions.googleSignIn.mockRejectedValue(asyncError);
    const report = jest.fn();
    await runProductBootstrap('journal', report, actions);
    expect(report).toHaveBeenCalledWith('guestSession', syncError);
    expect(report).toHaveBeenCalledWith('googleSignIn', asyncError);
    expect(actions.guestAnalysisMigration).toHaveBeenCalledTimes(1);
    expect(actions.guestDreamMigration).toHaveBeenCalledTimes(1);
  });

  it('defers work and cancels the queued scheduler task on cleanup', () => {
    const actions = dependencies();
    const pending = new Set<() => void>();
    const cancel = jest.fn();
    const cleanup = scheduleProductBootstrap('journal', (callback) => {
      pending.add(callback);
      return { cancel: () => { cancel(); pending.delete(callback); } };
    }, jest.fn(), actions);
    expect(actions.googleSignIn).not.toHaveBeenCalled();
    cleanup();
    pending.forEach((callback) => callback());
    expect(cancel).toHaveBeenCalledTimes(1);
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
  });

  it('starts work only when interactions finish and leaves already started work running', async () => {
    const actions = dependencies();
    let callback = () => {};
    let finish: () => void = () => {};
    actions.googleSignIn.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const cancel = jest.fn();
    const cleanup = scheduleProductBootstrap('lucid', (run) => {
      callback = run;
      return { cancel };
    }, jest.fn(), actions);
    callback();
    expect(actions.googleSignIn).toHaveBeenCalledTimes(1);
    cleanup();
    finish();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(actions.googleSignIn).toHaveBeenCalledTimes(1);
  });
});
