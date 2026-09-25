import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SelectableCard } from '@/components/onboarding/SelectableCard';

describe('SelectableCard', () => {
  it('defaults to a checkbox so multi-select goals are not radios', () => {
    render(<SelectableCard label="Sleep" selected={false} onPress={() => {}} />);

    const control = screen.getByRole('checkbox', { name: 'Sleep' });
    expect(control.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps exclusive choices as radios', () => {
    render(<SelectableCard label="Beginner" selected mode="single" onPress={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Beginner' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('toggles by calling onPress, including when already selected', () => {
    const onPress = jest.fn();
    render(<SelectableCard label="Sleep" selected onPress={onPress} />);

    fireEvent.press(screen.getByRole('checkbox', { name: 'Sleep' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
