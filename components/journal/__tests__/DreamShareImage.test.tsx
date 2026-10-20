/* @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DreamShareImage } from '@/components/journal/DreamShareImage';
import type { DreamAnalysis } from '@/lib/types';

jest.mock('@/hooks/useDreamMedia', () => ({ useDreamMedia: (dream: any) => ({ imageUrl: dream?.imageUrl, thumbnailUrl: dream?.thumbnailUrl, loading: false, error: false }) }));

jest.mock('expo-image', () => ({
  Image: ({ source, onLoad, onDisplay, onError }: any) => (
    <>
      <img alt="Dream" src={source.uri} onLoad={onLoad} onError={onError} />
      <button type="button" data-testid="dream-image-displayed" onClick={onDisplay}>Display image</button>
    </>
  ),
}));

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Image: () => <img alt="Noctalia" />,
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    StyleSheet: {
      absoluteFill: { position: 'absolute' },
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: React.forwardRef(function MockView(
      { children }: { children?: React.ReactNode },
      ref: React.ForwardedRef<HTMLDivElement>
    ) {
      return <div ref={ref}>{children}</div>;
    }),
  };
});


it('uses resolved media and signals readiness only after the image is displayed', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, imageUrl: 'private' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: 'https://signed/image' }} onMediaReady={ready} />);
  expect(screen.getByAltText('Dream').getAttribute('src')).toBe('https://signed/image');
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(screen.getByAltText('Dream'));
  expect(ready).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('dream-image-displayed'));
  expect(ready).toHaveBeenCalledWith('https://signed/image', true);
});


it('leaves out a picture not displayed in time, even when loading completed', () => {
  jest.useFakeTimers();
  try {
    const ready = jest.fn();
    const { unmount } = render(<DreamShareImage dream={{ id: 1 } as DreamAnalysis} t={key => key}
      resolvedMedia={{ imageUrl: 'https://signed/stalled' }} onMediaReady={ready} />);
    fireEvent.load(screen.getByAltText('Dream'));
    act(() => { jest.advanceTimersByTime(10000); });
    expect(ready).toHaveBeenCalledWith('https://signed/stalled', false);
    expect(screen.queryByAltText('Dream')).toBeNull();
    unmount();
  } finally { jest.useRealTimers(); }
});


it('is ready without its picture once a failed picture has been left out', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, title: 'Winged elephant' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: 'https://signed/broken' }} onMediaReady={ready} />);
  fireEvent.error(screen.getByAltText('Dream'));
  expect(screen.queryByAltText('Dream')).toBeNull();
  expect(screen.getByText('Winged elephant')).toBeTruthy();
  expect(ready).toHaveBeenCalledWith('https://signed/broken', false);
});


it('is ready at once when there is no picture to wait for', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, title: 'Winged elephant' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: '' }} onMediaReady={ready} />);
  expect(screen.queryByAltText('Dream')).toBeNull();
  expect(ready).toHaveBeenCalledWith('', false);
});


it.each([undefined, 'analysis-2026-09-17.1', 'analysis-2026-09-17.poetic1'])(
  'shares the quotation and only attributes a poetic generation to Noctalia (%s)', (promptVersion) => {
    const quote = 'A red bird carried me above the silence of the forest.';
    render(<DreamShareImage dream={{ id: 1, shareableQuote: quote, promptVersion } as DreamAnalysis} t={key => key} />);
    expect(screen.getByText(`“${quote}”`)).toBeTruthy();
    expect(Boolean(screen.queryByText('journal.detail.quote_attribution'))).toBe(promptVersion?.endsWith('.poetic1') ?? false);
  }
);
