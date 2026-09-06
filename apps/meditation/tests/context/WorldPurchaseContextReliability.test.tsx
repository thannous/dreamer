import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  WORLD_PURCHASE_REQUEST_TIMEOUT_MS,
  WorldPurchaseProvider,
  useWorldPurchases,
} from '@/context/WorldPurchaseContext';
import * as purchases from '@/services/worldPurchaseService';

jest.mock('@/services/worldPurchaseService', () => ({
  configure: jest.fn(),
  currentOwnership: jest.fn(),
  listOffers: jest.fn(),
  purchase: jest.fn(),
  restore: jest.fn(),
}));

const mockConfigure = jest.mocked(purchases.configure);
const mockCurrentOwnership = jest.mocked(purchases.currentOwnership);
const mockListOffers = jest.mocked(purchases.listOffers);
const mockPurchase = jest.mocked(purchases.purchase);
const mockRestore = jest.mocked(purchases.restore);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function mountPurchases() {
  return renderHook(() => useWorldPurchases(), {
    wrapper: ({ children }: React.PropsWithChildren) => (
      <WorldPurchaseProvider>{children}</WorldPurchaseProvider>
    ),
  });
}

describe('WorldPurchaseProvider reliability', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockConfigure.mockResolvedValue();
    mockCurrentOwnership.mockResolvedValue([]);
    mockListOffers.mockResolvedValue([]);
    mockPurchase.mockResolvedValue([]);
    mockRestore.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes verified ownership when offers fail', async () => {
    mockCurrentOwnership.mockResolvedValue(['tide']);
    mockListOffers.mockRejectedValue(new Error('catalog unavailable'));

    const { result } = mountPurchases();

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.isWorldOwned('tide')).toBe(true);
    expect(result.current.offers).toEqual([]);
  });

  it('publishes offers without inventing denied ownership when rights fail', async () => {
    mockCurrentOwnership.mockRejectedValue(new Error('ownership unavailable'));
    mockListOffers.mockResolvedValue([
      { worldId: 'tide', priceLabel: '0,99\u00a0€', raw: null },
    ]);

    const { result } = mountPurchases();

    await waitFor(() => expect(result.current.offersStatus).toBe('ready'));
    await waitFor(() => expect(result.current.ownershipStatus).toBe('error'));

    expect(result.current.offerForWorld('tide')?.priceLabel).toBe('0,99\u00a0€');
    expect(result.current.worldAccess('tide')).toBe('unknown');
    expect(result.current.isWorldOwned('tide')).toBe(false);
  });

  it('bounds a suspended offers request while ownership remains usable', async () => {
    jest.useFakeTimers();
    mockCurrentOwnership.mockResolvedValue(['tide']);
    mockListOffers.mockReturnValue(new Promise(() => {}));

    const { result } = mountPurchases();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isWorldOwned('tide')).toBe(true);
    expect(result.current.loaded).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(WORLD_PURCHASE_REQUEST_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(result.current.offersStatus).toBe('error');
    expect(result.current.loaded).toBe(true);
    expect(result.current.isWorldOwned('tide')).toBe(true);
  });

  it('ignores a late initial ownership response after a successful restore', async () => {
    const initialOwnership = deferred<('tide' | 'sanctuary' | 'cloud')[]>();
    mockCurrentOwnership.mockReturnValue(initialOwnership.promise);
    mockRestore.mockResolvedValue(['tide']);

    const { result } = mountPurchases();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await expect(result.current.restoreWorlds()).resolves.toEqual(['tide']);
    });
    expect(result.current.worldAccess('tide')).toBe('owned');

    await act(async () => {
      initialOwnership.resolve([]);
      await initialOwnership.promise;
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.isWorldOwned('tide')).toBe(true);
  });

  it('does not start stale bootstrap ownership after restore wins during configuration', async () => {
    const configuration = deferred<void>();
    mockConfigure.mockReturnValue(configuration.promise);
    mockRestore.mockResolvedValue(['tide']);

    const { result } = mountPurchases();

    let restorePromise!: Promise<readonly string[]>;
    await act(async () => {
      restorePromise = result.current.restoreWorlds();
      await Promise.resolve();
    });
    expect(mockRestore).not.toHaveBeenCalled();

    await act(async () => {
      configuration.resolve();
      await expect(restorePromise).resolves.toEqual(['tide']);
    });
    expect(result.current.isWorldOwned('tide')).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCurrentOwnership).not.toHaveBeenCalled();
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(result.current.isWorldOwned('tide')).toBe(true);
  });

  it('configures RevenueCat before starting a restore', async () => {
    const configuration = deferred<void>();
    mockConfigure.mockReturnValue(configuration.promise);
    mockRestore.mockResolvedValue(['tide']);

    const { result } = mountPurchases();

    let restorePromise!: Promise<readonly string[]>;
    await act(async () => {
      restorePromise = result.current.restoreWorlds();
      await Promise.resolve();
    });

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(result.current.ownershipStatus).toBe('loading');

    await act(async () => {
      configuration.resolve();
      await expect(restorePromise).resolves.toEqual(['tide']);
    });

    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(result.current.worldAccess('tide')).toBe('owned');
  });

  it('leaves a failed restore recoverable when it supersedes initialization', async () => {
    const initialOwnership = deferred<('tide' | 'sanctuary' | 'cloud')[]>();
    mockCurrentOwnership
      .mockReturnValueOnce(initialOwnership.promise)
      .mockResolvedValueOnce(['tide']);
    mockRestore.mockRejectedValue(new Error('store unavailable'));

    const { result } = mountPurchases();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await expect(result.current.restoreWorlds()).rejects.toThrow('store unavailable');
    });
    expect(result.current.ownershipStatus).toBe('error');

    await act(async () => {
      await result.current.retryOwnership();
    });
    expect(result.current.ownershipStatus).toBe('ready');
    expect(result.current.isWorldOwned('tide')).toBe(true);

    initialOwnership.resolve([]);
    await initialOwnership.promise;
  });

  it('retries ownership independently and preserves verified rights on a later error', async () => {
    mockCurrentOwnership.mockResolvedValueOnce(['tide']).mockRejectedValueOnce(new Error('offline'));

    const { result } = mountPurchases();
    await waitFor(() => expect(result.current.worldAccess('tide')).toBe('owned'));

    await act(async () => {
      await result.current.retryOwnership();
    });

    expect(result.current.ownershipStatus).toBe('error');
    expect(result.current.worldAccess('tide')).toBe('owned');
    expect(result.current.isWorldOwned('tide')).toBe(true);
  });
});
