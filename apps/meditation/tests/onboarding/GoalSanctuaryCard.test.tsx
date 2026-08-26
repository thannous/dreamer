import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GoalSanctuaryCard } from '@/components/onboarding/GoalSanctuaryCard';

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren) => children,
}));

describe('GoalSanctuaryCard', () => {
  const artwork = { uri: 'goal.webp' };

  it('exposes an illustrated goal as a multi-select checkbox', () => {
    render(
      <GoalSanctuaryCard
        artwork={artwork}
        height={160}
        label="See the positive"
        selected={false}
        onPress={() => {}}
      />
    );

    const goal = screen.getByRole('checkbox', { name: 'See the positive' });
    expect(goal.props.accessibilityState).toEqual({ checked: false });
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps the selected state explicit and can be deselected', () => {
    const onPress = jest.fn();
    render(
      <GoalSanctuaryCard
        artwork={artwork}
        height={160}
        label="Sleep better"
        selected
        onPress={onPress}
      />
    );

    const goal = screen.getByRole('checkbox', { name: 'Sleep better' });
    expect(goal.props.accessibilityState).toEqual({ checked: true });

    fireEvent.press(goal);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
