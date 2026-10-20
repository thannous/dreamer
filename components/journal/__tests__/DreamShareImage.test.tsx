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
    // The seal's emblem is tinted; the card's other marks are Noctalia's logo.
    Image: ({ onLoad, onError, style }: any) => (
      <img alt={Array.isArray(style) ? 'Seal' : 'Noctalia'} onLoad={onLoad} onError={onError} />
    ),
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

const drawMarks = () => screen.getAllByAltText('Noctalia').forEach(mark => fireEvent.load(mark));

it('uses resolved media and signals readiness only after the image is displayed', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, imageUrl: 'private' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: 'https://signed/image' }} onMediaReady={ready} />);
  expect(screen.getByAltText('Dream').getAttribute('src')).toBe('https://signed/image');
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(screen.getByAltText('Dream'));
  expect(ready).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('dream-image-displayed'));
  // The card's mark still loading, the card is not drawn yet.
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(screen.getByAltText('Noctalia'));
  expect(ready).toHaveBeenCalledWith('https://signed/image', true);
});


it('leaves out a picture not displayed in time, even when loading completed', () => {
  jest.useFakeTimers();
  try {
    // Reported only once the card is drawn without it.
    const ready = jest.fn(() => expect(screen.queryByAltText('Dream')).toBeNull());
    const { unmount } = render(<DreamShareImage dream={{ id: 1 } as DreamAnalysis} t={key => key}
      resolvedMedia={{ imageUrl: 'https://signed/stalled' }} onMediaReady={ready} />);
    fireEvent.load(screen.getByAltText('Dream'));
    drawMarks();
    act(() => { jest.advanceTimersByTime(10000); });
    // The night it now rests on is drawn before the card is.
    expect(ready).not.toHaveBeenCalled();
    drawMarks();
    expect(ready).toHaveBeenCalledWith('https://signed/stalled', false);
    expect(screen.queryByAltText('Dream')).toBeNull();
    unmount();
  } finally { jest.useRealTimers(); }
});


it('is ready without its picture once a failed picture has been left out', () => {
  const ready = jest.fn(() => expect(screen.queryByAltText('Dream')).toBeNull());
  render(<DreamShareImage dream={{ id: 1, title: 'Winged elephant' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: 'https://signed/broken' }} onMediaReady={ready} />);
  drawMarks();
  fireEvent.error(screen.getByAltText('Dream'));
  drawMarks();
  expect(screen.getByText('Winged elephant')).toBeTruthy();
  expect(ready).toHaveBeenCalledWith('https://signed/broken', false);
});


it('is ready as soon as its mark is drawn when there is no picture to wait for', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, title: 'Winged elephant' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: '' }} onMediaReady={ready} />);
  expect(screen.queryByAltText('Dream')).toBeNull();
  expect(ready).not.toHaveBeenCalled();
  drawMarks();
  expect(ready).toHaveBeenCalledWith('', false);
});


it('does not wait long for a mark that never reports', () => {
  jest.useFakeTimers();
  try {
    const ready = jest.fn();
    const { unmount } = render(<DreamShareImage dream={{ id: 1 } as DreamAnalysis} t={key => key}
      resolvedMedia={{ imageUrl: '' }} onMediaReady={ready} />);
    act(() => { jest.advanceTimersByTime(999); });
    expect(ready).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(ready).toHaveBeenCalledWith('', false);
    unmount();
  } finally { jest.useRealTimers(); }
});


it.each([undefined, 'analysis-2026-09-17.1', 'analysis-2026-09-17.poetic1'])(
  'shares the quotation and only attributes a poetic generation to Noctalia (%s)', (promptVersion) => {
    const quote = 'A red bird carried me above the silence of the forest.';
    render(<DreamShareImage dream={{ id: 1, shareableQuote: quote, promptVersion } as DreamAnalysis} t={key => key} />);
    expect(screen.getByText(`“${quote}”`)).toBeTruthy();
    expect(Boolean(screen.queryByText('journal.detail.quote_attribution'))).toBe(promptVersion?.endsWith('.poetic1') ?? false);
  }
);


it('waits for the seal it rests on when the card has no picture', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ id: 1, theme: 'surreal' } as DreamAnalysis} t={key => key}
    resolvedMedia={{ imageUrl: '' }} onMediaReady={ready} />);
  drawMarks();
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(screen.getByAltText('Seal'));
  expect(ready).toHaveBeenCalledWith('', false);
});


it('waits anew for the seal a failed picture leaves the card on, even after a slow logo', () => {
  jest.useFakeTimers();
  try {
    const ready = jest.fn();
    const { unmount } = render(<DreamShareImage dream={{ id: 1, theme: 'surreal' } as DreamAnalysis} t={key => key}
      resolvedMedia={{ imageUrl: 'https://signed/broken' }} onMediaReady={ready} />);
    // The logo took longer than the card waits for its marks.
    act(() => { jest.advanceTimersByTime(1000); });
    fireEvent.error(screen.getByAltText('Dream'));
    expect(ready).not.toHaveBeenCalled();
    drawMarks();
    expect(ready).not.toHaveBeenCalled();
    fireEvent.load(screen.getByAltText('Seal'));
    expect(ready).toHaveBeenCalledWith('https://signed/broken', false);
    unmount();
  } finally { jest.useRealTimers(); }
});


const chosenDream = {
  id: 1,
  title: 'Winged elephant',
  transcript: 'An elephant with wings carried my dog over the sea.',
  shareableQuote: 'The sea held its breath for us.',
} as DreamAnalysis;

it('shows only what the dreamer chose, with the Noctalia Dream footer', () => {
  const ready = jest.fn();
  render(<DreamShareImage dream={{ ...chosenDream, imageUrl: 'https://cdn/image' }} t={key => key} date="Sunday 18 October 2026"
    resolvedMedia={{ imageUrl: 'https://signed/image' }} onMediaReady={ready}
    options={{ painting: false, title: false, date: true, text: 'story' }} />);
  expect(screen.queryByAltText('Dream')).toBeNull();
  expect(screen.queryByText('Winged elephant')).toBeNull();
  expect(screen.queryByText('“The sea held its breath for us.”')).toBeNull();
  expect(screen.getByText('Sunday 18 October 2026')).toBeTruthy();
  expect(screen.getByText(chosenDream.transcript)).toBeTruthy();
  expect(screen.getByText('journal.detail.share_image.footer')).toBeTruthy();
  drawMarks();
  // A picture left out is not waited for.
  expect(ready).toHaveBeenCalledWith('', false);
});

it('keeps the Noctalia Dream footer on a card the dreamer emptied', () => {
  render(<DreamShareImage dream={chosenDream} t={key => key} date="Sunday 18 October 2026" resolvedMedia={{ imageUrl: '' }}
    options={{ painting: false, title: false, date: false, text: 'none' }} />);
  expect(screen.queryByText('Winged elephant')).toBeNull();
  expect(screen.queryByText('Sunday 18 October 2026')).toBeNull();
  expect(screen.queryByText(chosenDream.transcript)).toBeNull();
  expect(screen.getByText('journal.detail.share_image.footer')).toBeTruthy();
});

it('carries the opening of a long story, ended on a whole word', () => {
  const transcript = `${'The corridor kept turning and the doors kept opening onto the same garden. '.repeat(8)}End.`;
  const { container } = render(<DreamShareImage dream={{ ...chosenDream, transcript }} t={key => key} resolvedMedia={{ imageUrl: '' }}
    options={{ painting: false, title: true, date: false, text: 'story' }} />);
  const story = Array.from(container.querySelectorAll('span')).map(node => node.textContent ?? '')
    .find(text => text.startsWith('The corridor'));
  expect(story).toBeDefined();
  expect(story!.length).toBeLessThanOrEqual(321);
  expect(story!.endsWith('…')).toBe(true);
  expect(transcript.startsWith(story!.slice(0, -1))).toBe(true);
  expect(transcript.charAt(story!.length - 1)).toBe(' ');
});
