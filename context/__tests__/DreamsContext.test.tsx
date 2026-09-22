/* @jest-environment jsdom */
import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DreamAnalysis } from '../../lib/types';

const { mockJournal } = ((factory: any) => factory())(() => {
  const mockJournal = {
    dreams: [{ id: 1, title: 'Dream', transcript: 'text', isAnalyzed: false }],
    loaded: true,
    persistenceState: { status: 'ready', target: 'device' } as const,
    addDream: jest.fn(async (dream: DreamAnalysis) => dream),
    updateDream: jest.fn(async () => undefined),
    applyDreamCategorization: jest.fn(async () => null),
    deleteDream: jest.fn(async () => undefined),
    toggleFavorite: jest.fn(async () => undefined),
    reloadDreams: jest.fn(async () => undefined),
    retryPersistence: jest.fn(async () => undefined),
    generateDreamImage: jest.fn(async () => ({ id: 1 })),
    analyzeDream: jest.fn(async () => ({ id: 1 })),
  };

  return { mockJournal };
});

jest.mock('../../hooks/useDreamJournal', () => ({
  useDreamJournal: () => mockJournal,
}));

const { DreamsProvider, useDreams, useDreamsActions, useDreamsData, useDreamsStatus, useOptionalDreamsActions } = require('../DreamsContext');

describe('DreamsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('given provider__when reading data__then exposes dreams and loaded', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsData(), { wrapper });

    expect(result.current.dreams).toEqual(mockJournal.dreams);
    expect(result.current.loaded).toBe(true);
  });

  it('notifies status consumers without rendering data consumers when saving settles', () => {
    let dataRenders = 0;
    const statuses: string[] = [];
    const Data = React.memo(function Data() {
      useDreamsData();
      dataRenders++;
      return null;
    });
    const Status = React.memo(function Status() {
      statuses.push(useDreamsStatus().persistenceState.status);
      return null;
    });
    const original = mockJournal.persistenceState;
    const children = <><Data /><Status /></>;
    const view = render(<DreamsProvider>{children}</DreamsProvider>);
    try {
      Object.assign(mockJournal, { persistenceState: { status: 'saving', target: 'device' } });
      view.rerender(<DreamsProvider>{children}</DreamsProvider>);
      mockJournal.persistenceState = original;
      view.rerender(<DreamsProvider>{children}</DreamsProvider>);
      expect(dataRenders).toBe(1);
      expect(statuses).toEqual(['ready', 'saving', 'ready']);
    } finally {
      mockJournal.persistenceState = original;
      view.unmount();
    }
  });

  it('given provider__when invoking actions__then delegates to journal', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsActions(), { wrapper });

    await result.current.addDream({ id: 2 } as any);
    expect(mockJournal.addDream).toHaveBeenCalledWith({ id: 2 });
    await result.current.reloadDreams();
    expect(mockJournal.reloadDreams).toHaveBeenCalledTimes(1);
    await result.current.retryPersistence();
    expect(mockJournal.retryPersistence).toHaveBeenCalledTimes(1);
  });

  it('given provider__when using combined hook__then returns data and actions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreams(), { wrapper });

    expect(result.current.dreams).toEqual(mockJournal.dreams);
    expect(result.current.addDream).toBe(mockJournal.addDream);
    expect(result.current.persistenceState).toEqual({ status: 'ready', target: 'device' });
  });

  it('given missing provider__when using data hook__then throws', () => {
    expect(() => renderHook(() => useDreamsData())).toThrow(
      'useDreamsData must be used within DreamsProvider'
    );
  });

  it('given missing provider__when using actions hook__then throws', () => {
    expect(() => renderHook(() => useDreamsActions())).toThrow(
      'useDreamsActions must be used within DreamsProvider'
    );
  });

  it('given missing provider__when using optional actions hook__then returns null', () => {
    const { result } = renderHook(() => useOptionalDreamsActions());
    expect(result.current).toBeNull();
  });
});
