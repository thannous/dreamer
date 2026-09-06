import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { JournalPersistenceNotice } from '../JournalPersistenceNotice';

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/motion', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    PressableScale: ({ children, ...props }: any) => (
      <Pressable {...props}>{children}</Pressable>
    ),
  };
});

describe('JournalPersistenceNotice', () => {
  it('shows a recoverable read incident instead of an empty-journal message', () => {
    const onRetry = jest.fn();
    render(
      <JournalPersistenceNotice
        state={{ status: 'error', operation: 'read', target: 'device' }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('journal.persistence.read_device')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('describes remote cache durability separately from cloud synchronization', () => {
    render(
      <JournalPersistenceNotice
        state={{ status: 'error', operation: 'write', target: 'remote-cache' }}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText('journal.persistence.write_cache')).toBeTruthy();
  });

  it('stays hidden when storage is ready', () => {
    const { toJSON } = render(
      <JournalPersistenceNotice
        state={{ status: 'ready', target: 'device' }}
        onRetry={jest.fn()}
      />
    );
    expect(toJSON()).toBeNull();
  });
});
