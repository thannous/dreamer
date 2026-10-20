/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { DreamShareSheet } from '@/components/journal/DreamShareSheet';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'ios' },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children, accessibilityLabel }: { children?: React.ReactNode; accessibilityLabel?: string }) => (
      <div aria-label={accessibilityLabel}>{children}</div>
    ),
  };
});

jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({ visible, title, children, actions }: any) => visible ? (
    <section>
      <h1>{title}</h1>
      {children}
      <button data-testid={actions.primaryTestID} data-loading={String(Boolean(actions.primaryLoading))} onClick={actions.onPrimary}>
        {actions.primaryLabel}
      </button>
    </section>
  ) : null,
}));

jest.mock('@/components/motion', () => ({
  PressableScale: ({ children, onPress, accessibilityRole, accessibilityState, accessibilityLabel }: any) => (
    <button role={accessibilityRole} aria-checked={accessibilityState?.checked} aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));

// The preview shows the very card that will be shared.
jest.mock('@/components/journal/DreamShareImage', () => ({
  DreamShareImage: ({ options, resolvedMedia, date }: any) => (
    <div data-testid="share-preview" data-options={JSON.stringify(options)} data-painting={resolvedMedia.imageUrl} data-date={date} />
  ),
}));

jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({ action: { primaryText: '#382D35' } }),
}));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const dream = {
  id: 1,
  title: 'Winged elephant',
  transcript: 'An elephant with wings carried my dog over the sea.',
  shareableQuote: 'The sea held its breath for us.',
} as DreamAnalysis;

function renderSheet(overrides: Partial<React.ComponentProps<typeof DreamShareSheet>> = {}) {
  const onShare = jest.fn();
  const props = {
    visible: true,
    onClose: jest.fn(),
    onShare,
    dream,
    date: 'Sunday 18 October 2026',
    painting: 'https://signed/image',
    paintingPending: false,
    sharing: false,
    ...overrides,
  };
  const view = render(<DreamShareSheet {...props} />);
  return { ...view, onShare, props };
}

const choice = (label: string) => screen.getByLabelText(label);
const previewOptions = () => JSON.parse(screen.getByTestId('share-preview').getAttribute('data-options') ?? '{}');

describe('DreamShareSheet', () => {
  it('first offers the illustration, the title, the date and the inspired line', () => {
    const { onShare } = renderSheet();
    expect(choice('journal.detail.share_sheet.painting').getAttribute('aria-checked')).toBe('true');
    expect(choice('journal.detail.share_sheet.name').getAttribute('aria-checked')).toBe('true');
    expect(choice('journal.detail.share_sheet.date').getAttribute('aria-checked')).toBe('true');
    expect(choice('journal.detail.share_sheet.text_quote').getAttribute('aria-checked')).toBe('true');
    expect(choice('journal.detail.share_sheet.text_story').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('share-preview').getAttribute('data-painting')).toBe('https://signed/image');
    fireEvent.click(screen.getByTestId(TID.Button.DreamShareCard));
    expect(onShare).toHaveBeenCalledWith({ painting: true, title: true, date: true, text: 'quote' });
  });

  it('shares exactly the card the preview shows after the dreamer changes it', () => {
    const { onShare } = renderSheet();
    fireEvent.click(choice('journal.detail.share_sheet.painting'));
    fireEvent.click(choice('journal.detail.share_sheet.date'));
    fireEvent.click(choice('journal.detail.share_sheet.text_story'));
    const card = { painting: false, title: true, date: false, text: 'story' };
    expect(previewOptions()).toEqual(card);
    expect(screen.getByTestId('share-preview').getAttribute('data-painting')).toBe('');
    fireEvent.click(screen.getByTestId(TID.Button.DreamShareCard));
    expect(onShare).toHaveBeenCalledWith(card);
  });

  it('offers only what the dream has', () => {
    const { onShare } = renderSheet({ dream: { id: 1, title: '', transcript: 'A door.' } as DreamAnalysis, painting: '' });
    expect(screen.queryByLabelText('journal.detail.share_sheet.painting')).toBeNull();
    expect(screen.queryByLabelText('journal.detail.share_sheet.name')).toBeNull();
    expect(screen.queryByLabelText('journal.detail.share_sheet.text_quote')).toBeNull();
    expect(choice('journal.detail.share_sheet.text_none').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId(TID.Button.DreamShareCard));
    expect(onShare).toHaveBeenCalledWith({ painting: false, title: false, date: true, text: 'none' });
  });

  it('waits for an illustration still being signed only while it is on the card', () => {
    renderSheet({ painting: '', paintingPending: true });
    expect(screen.getByTestId(TID.Button.DreamShareCard).getAttribute('data-loading')).toBe('true');
    fireEvent.click(choice('journal.detail.share_sheet.painting'));
    expect(screen.getByTestId(TID.Button.DreamShareCard).getAttribute('data-loading')).toBe('false');
  });

  it('starts again from the first offer each time it opens', () => {
    const { rerender, props } = renderSheet();
    fireEvent.click(choice('journal.detail.share_sheet.name'));
    expect(previewOptions().title).toBe(false);
    rerender(<DreamShareSheet {...props} visible={false} />);
    rerender(<DreamShareSheet {...props} visible />);
    expect(previewOptions().title).toBe(true);
  });
});
