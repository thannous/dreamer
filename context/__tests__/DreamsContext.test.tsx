/* @jest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
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

const { DreamsProvider, useDreamsData, useDreamsStatus } = require('../DreamsContext');

describe('DreamsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
