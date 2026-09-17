import { render, screen } from '@testing-library/react-native';
import React from 'react';

import {
  PRACTICE_PROGRESS_TEST_ID,
  PracticeProgress,
} from '@/components/journey/PracticeProgress';
import {
  WORLD_PATH_PROGRESS_TEST_ID,
  WorldPathProgress,
} from '@/components/journey/WorldPathProgress';
import { WORLD_BY_ID } from '@/constants/worlds';

describe('practice wayfinding', () => {
  it.each([
    ['prepare', 1, 'Prepare'],
    ['practice', 2, 'Practice'],
    ['settle', 3, 'Settle'],
  ] as const)('announces the %s stage as an exact three-step progress value', (stage, now, label) => {
    render(<PracticeProgress world={WORLD_BY_ID.constellation} stage={stage} />);

    const progress = screen.getByTestId(PRACTICE_PROGRESS_TEST_ID);
    expect(progress.props.accessibilityRole).toBe('progressbar');
    expect(progress.props.accessibilityValue).toEqual({ min: 1, max: 3, now });
    expect(progress.props.accessibilityLabel).toContain('Constellation');
    expect(progress.props.accessibilityLabel).toContain(`${now}/3 · ${label}`);
  });

  it('advances the separate world path from completed editorial sessions', () => {
    const view = render(
      <WorldPathProgress
        world={WORLD_BY_ID.constellation}
        progress={{
          'sleep-descent': {
            positionSec: 600,
            completedCount: 1,
            lastPlayedISO: '2026-08-23T20:00:00.000Z',
          },
        }}
      />
    );

    const progress = screen.getByTestId(WORLD_PATH_PROGRESS_TEST_ID);
    expect(progress.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 2 });
    expect(progress.props.accessibilityLabel).toContain('2/3');
    expect(progress.props.accessibilityLabel).toContain('Follow the space between breaths');

    view.unmount();
  });
});
