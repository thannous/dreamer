import React from 'react';
import { act, render } from '@testing-library/react-native-legacy';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DreamSymbolConstellation } from '@/components/journal/story/DreamSymbolConstellation';

// The echo is heard as the returning symbol lights, on the page being read. A page left
// before that moment stays mounted behind the next screen: its echo must not sound there,
// nor later when the dreamer comes back to it.

const mockPlaySignature = jest.fn();
jest.mock('@/services/signatureSounds', () => ({ playSignature: (sound: string) => mockPlaySignature(sound) }));
let mockOnScreen = true;
jest.mock('@/components/ui/headerStretch', () => ({ useOnScreen: () => mockOnScreen }));
jest.mock('@/components/journal/symbols/SymbolMedallion', () => ({ SymbolMedallion: () => null }));

const stars = [
  { name: 'Water', count: 1, fresh: false },
  { name: 'Cat', count: 3, fresh: false },
];
const page = () => <DreamSymbolConstellation stars={stars} play onOpen={() => {}} />;

describe('DreamSymbolConstellation echo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPlaySignature.mockClear();
    mockOnScreen = true;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers once as the returning symbol lights', () => {
    const view = render(page());
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    view.rerender(page());
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockPlaySignature.mock.calls).toEqual([['echo']]);
  });

  it('stays silent when the page is left before, and on the way back', () => {
    const view = render(page());
    mockOnScreen = false;
    view.rerender(page());
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    mockOnScreen = true;
    view.rerender(page());
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockPlaySignature).not.toHaveBeenCalled();
  });
});
