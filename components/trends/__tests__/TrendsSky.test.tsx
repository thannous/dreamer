import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native-legacy';
import { describe, expect, it, jest } from '@jest/globals';

import { TrendsSky } from '@/components/trends/TrendsSky';
import type { DreamSky } from '@/lib/dreamSky';
import type { DreamAnalysis } from '@/lib/types';

// With VoiceOver or TalkBack the stars cannot be touched one by one: the sky must let a
// screen reader step from dream to dream and open the one it is on, as a finger would.

jest.mock('@/components/journal/symbols/SymbolMedallion', () => ({ SymbolMedallion: () => null }));

const dream = (day: number, title: string): DreamAnalysis => ({
  id: new Date(2026, 9, day, 6).getTime(),
  transcript: 'x',
  title,
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
});
const older = dream(12, 'The flooded hall');
const newer = dream(14, '');
const sky: DreamSky = {
  stars: [
    { dream: older, x: 0.3, y: 0.4, analyzed: true, fullMoon: false },
    { dream: newer, x: 0.8, y: 0.6, analyzed: false, fullMoon: false },
  ],
  constellations: [],
  total: 2,
};
const t = (key: string) => (key === 'trends.nights.untitled' ? 'Untitled dream' : key);
const formatDate = (value: Date | number) => `day ${new Date(value).getDate()}`;

const renderSky = (onOpenDream: (dream: DreamAnalysis) => void) => {
  const view = render(
    <TrendsSky sky={sky} lit reduced={false} ink="#fff" glow="#fff" glowOpacity={0.3} dust="#fff" silver="#ccc" t={t}
      formatNumber={String} formatDate={formatDate} onOpenDream={onOpenDream} />,
  );
  return view.getByTestId('trends.sky.canvas');
};

describe('TrendsSky with a screen reader', () => {
  it('starts on the newest dream, steps back to an older one and opens it', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onOpenDream = jest.fn();
    const canvas = renderSky(onOpenDream);

    expect(canvas.props.accessibilityRole).toBe('adjustable');
    expect(canvas.props['aria-valuetext']).toBe('Untitled dream, day 14');

    fireEvent(canvas, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(canvas.props['aria-valuetext']).toBe('The flooded hall, day 12');
    // Already on the oldest dream: it stays there.
    fireEvent(canvas, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    fireEvent(canvas, 'accessibilityTap');

    expect(onOpenDream).toHaveBeenCalledTimes(1);
    expect(onOpenDream).toHaveBeenCalledWith(older);
  });

  it('tells TalkBack where it stands and opens through its own action', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const onOpenDream = jest.fn();
    const canvas = renderSky(onOpenDream);

    fireEvent(canvas, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    fireEvent(canvas, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(canvas, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    expect(announce.mock.calls).toEqual([['The flooded hall, day 12'], ['Untitled dream, day 14']]);
    expect(onOpenDream).toHaveBeenCalledWith(newer);
  });

  it('takes the keyboard on the web: arrows step and ring the star, Enter opens it', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onOpenDream = jest.fn();
    const view = render(
      <TrendsSky sky={sky} lit reduced={false} ink="#fff" glow="#fff" glowOpacity={0.3} dust="#fff" silver="#ccc" t={t}
        formatNumber={String} formatDate={formatDate} onOpenDream={onOpenDream} />,
    );
    const canvas = view.getByTestId('trends.sky.canvas');
    fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 300, height: 280 } } });
    const key = (name: string) => {
      const preventDefault = jest.fn();
      fireEvent(view.getByTestId('trends.sky.canvas'), 'keyDown', { key: name, preventDefault });
      return preventDefault;
    };

    expect(view.queryByTestId('trends.sky.ring')).toBeNull();
    expect(key('ArrowLeft')).toHaveBeenCalled();
    expect(view.getByTestId('trends.sky.canvas').props['aria-valuetext']).toBe('The flooded hall, day 12');
    expect(view.getByTestId('trends.sky.ring')).toBeTruthy();
    // Other keys keep their own meaning, Tab first.
    expect(key('Tab')).not.toHaveBeenCalled();
    key('Enter');

    expect(onOpenDream).toHaveBeenCalledWith(older);
  });
});

describe('TrendsSky under a finger', () => {
  it('opens the star a tap lands on, not the one a slide ends or comes back on', () => {
    const onOpenDream = jest.fn();
    const view = render(
      <TrendsSky sky={sky} lit reduced={false} ink="#fff" glow="#fff" glowOpacity={0.3} dust="#fff" silver="#ccc" t={t}
        formatNumber={String} formatDate={formatDate} onOpenDream={onOpenDream} />,
    );
    fireEvent(view.getByTestId('trends.sky.canvas'), 'layout', { nativeEvent: { layout: { width: 300, height: 280 } } });
    const stars = view.getByTestId('trends.sky.stars');
    // The page point is where the finger is on screen; the location is inside the sky.
    const touch = (x: number, y: number) => ({ nativeEvent: { pageX: x + 16, pageY: y + 400, locationX: x, locationY: y } });

    // Slid from an empty corner of the sky to the newer star, then lifted there.
    fireEvent(stars, 'pressIn', touch(40, 40));
    fireEvent.press(stars, touch(226, 162));
    expect(onOpenDream).not.toHaveBeenCalled();

    // Slid away from the older star and back onto it before lifting: still a slide.
    fireEvent(stars, 'pressIn', touch(97, 116));
    fireEvent(stars, 'pressMove', touch(160, 116));
    fireEvent(stars, 'pressMove', touch(99, 117));
    fireEvent.press(stars, touch(99, 117));
    expect(onOpenDream).not.toHaveBeenCalled();

    // Tapped on the older star, with the small wobble of a real finger.
    fireEvent(stars, 'pressIn', touch(97, 116));
    fireEvent(stars, 'pressMove', touch(99, 117));
    fireEvent.press(stars, touch(100, 118));
    expect(onOpenDream).toHaveBeenCalledTimes(1);
    expect(onOpenDream).toHaveBeenCalledWith(older);
  });
});
