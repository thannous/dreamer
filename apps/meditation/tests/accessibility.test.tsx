import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';

import { NightBackground } from '@/components/atmosphere/NightBackground';
import { ProgressScrubber } from '@/components/player/ProgressScrubber';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { SEEK_STEP_SEC } from '@/lib/audio';
import { calendarDays } from '@/lib/streak';

/**
 * Accessibility invariants.
 *
 * These are the failures that never show up in a screenshot: a control that
 * clips at 200% text scaling, a decorative gradient read aloud, a slider a
 * screen reader cannot move.
 */
describe('text scaling', () => {
  // A fixed height clips the label instead of growing with it. Minimum heights
  // keep the 44pt target at normal scale and let the control grow beyond it.
  const hasFixedHeight = (style: unknown): boolean => {
    const flat = JSON.stringify(style ?? {});
    return /"height":\s*\d/.test(flat);
  };

  it('the button grows with its text rather than clipping it', () => {
    render(<Button label="Commencer" />);
    expect(hasFixedHeight(screen.getByRole('button').props.style)).toBe(false);
  });

  it('the chip grows with its text', () => {
    render(<Chip label="10 min" onPress={() => {}} />);
    expect(hasFixedHeight(screen.getByRole('button').props.style)).toBe(false);
  });

  it('the text field grows with its content', () => {
    render(<TextField label="Email" hideLabel />);
    expect(hasFixedHeight(screen.getByLabelText('Email').props.style)).toBe(false);
  });

  it('leaves font scaling on', () => {
    // Disabling it would be the easy way to stop things clipping, and it is
    // exactly what breaks the app for someone who needs larger type.
    render(<Button label="Commencer" />);
    expect(screen.getByText('Commencer').props.allowFontScaling).not.toBe(false);
  });

  it('scales the line box with Dynamic Type so enlarged glyphs are not cropped', () => {
    const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 368,
      height: 800,
      scale: 3,
      fontScale: 2,
    });

    render(<Text variant="h1">Titre agrandi</Text>);

    expect(ReactNative.StyleSheet.flatten(screen.getByText('Titre agrandi').props.style)).toEqual(
      expect.objectContaining({ lineHeight: 68 })
    );
    dimensions.mockRestore();
  });
});

describe('decorative layers', () => {
  it('keeps the atmosphere out of the accessibility tree', () => {
    const { toJSON } = render(<NightBackground />);
    const root = JSON.parse(JSON.stringify(toJSON()));
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('progress scrubber', () => {
  it('announces its position as a value, not as a bar', () => {
    render(<ProgressScrubber positionSec={60} durationSec={600} onSeek={() => {}} />);
    const scrubber = screen.getByRole('adjustable');

    expect(scrubber.props.accessibilityValue).toEqual({ min: 0, max: 600, now: 60 });
  });

  it('can be moved without touching a four-pixel bar', () => {
    const onSeek = jest.fn();
    render(<ProgressScrubber positionSec={60} durationSec={600} onSeek={onSeek} />);
    const scrubber = screen.getByRole('adjustable');

    fireEvent(scrubber, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onSeek).toHaveBeenCalledWith(60 + SEEK_STEP_SEC);

    fireEvent(scrubber, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onSeek).toHaveBeenCalledWith(60 - SEEK_STEP_SEC);
  });

  it('does not seek past either end', () => {
    const onSeek = jest.fn();
    render(<ProgressScrubber positionSec={5} durationSec={600} onSeek={onSeek} />);

    fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});

describe('streak calendar', () => {
  it('summarises the grid instead of reading thirty-five dates', () => {
    const days = calendarDays(
      [{ dateISO: '2026-08-19', seconds: 600 }],
      '2026-08-19'
    );
    render(<StreakCalendar days={days} />);

    const summary = screen.getByRole('summary');
    expect(summary.props.accessibilityLabel).toContain('1');
    expect(screen.queryByLabelText('2026-08-19')).toBeNull();
  });
});
