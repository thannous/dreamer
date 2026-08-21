import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { Button } from '@/components/ui/Button';

/**
 * These also guard the harness itself: every interactive component now imports
 * Reanimated, which dies at module load without the worklets resolver in
 * jest.config.js. If that resolver is dropped, this file fails to even import.
 */
describe('Button', () => {
  it('renders its label', () => {
    render(<Button label="Commencer" />);
    expect(screen.getByText('Commencer')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button label="Commencer" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

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
