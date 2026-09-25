import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { Button } from '@/components/ui/Button';

describe('Button', () => {

  it('does not call onPress while disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Commencer" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports its busy state while loading', () => {
    render(<Button label="Commencer" loading />);
    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ busy: true });
  });
});
