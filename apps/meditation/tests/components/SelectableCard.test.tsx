import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SelectableCard } from '@/components/onboarding/SelectableCard';

const classNames = (node: unknown): string[] => {
  if (!node || typeof node !== 'object') return [];

  const tree = node as { props?: { className?: string }; children?: unknown };
  const own = tree.props?.className ? [tree.props.className] : [];
  const children = Array.isArray(tree.children)
    ? tree.children
    : tree.children
      ? [tree.children]
      : [];

  return own.concat(children.flatMap(classNames));
};

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

  it('draws a rounded square for multi-select, not a radio disc', () => {
    const { toJSON } = render(<SelectableCard label="Sleep" selected onPress={() => {}} />);
    const classes = classNames(toJSON()).join(' ');

    expect(classes).toMatch(/h-5 w-5[^"]*rounded-sm/);
    expect(classes).not.toMatch(/h-5 w-5[^"]*rounded-full/);
  });

  it('keeps the radio disc on exclusive steps', () => {
    const { toJSON } = render(
      <SelectableCard label="Beginner" selected mode="single" onPress={() => {}} />
    );
    const classes = classNames(toJSON()).join(' ');

    expect(classes).toMatch(/h-5 w-5[^"]*rounded-full/);
    expect(classes).not.toMatch(/h-5 w-5[^"]*rounded-sm/);
  });

  it('toggles by calling onPress, including when already selected', () => {
    const onPress = jest.fn();
    render(<SelectableCard label="Sleep" selected onPress={onPress} />);

    fireEvent.press(screen.getByRole('checkbox', { name: 'Sleep' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
