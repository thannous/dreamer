import React from 'react';

type CommonProps = {
  children?: React.ReactNode;
  hidden?: boolean;
  label?: string;
  modifiers?: ExpoUIModifier[];
  testID?: string;
};

type ExpoUILayout = { height: number; width: number; x: number; y: number };
type ExpoUIModifier = {
  $type?: string;
  eventListener?: (layout: ExpoUILayout) => void;
};

const positionedLayouts = new Map<string, ExpoUILayout>();

export function setExpoUIPositionedLayout(testID: string, layout: ExpoUILayout) {
  positionedLayouts.set(testID, layout);
}

export function resetExpoUIPositionedLayouts() {
  positionedLayouts.clear();
}

function usePositionedLayout(testID: string | undefined, modifiers: ExpoUIModifier[] | undefined) {
  const positionedModifier = modifiers?.find(
    (modifier) => modifier.$type === 'onGloballyPositioned'
  );
  const positionedLayout = testID ? positionedLayouts.get(testID) : undefined;

  React.useEffect(() => {
    if (positionedLayout) positionedModifier?.eventListener?.(positionedLayout);
  }, [positionedLayout, positionedModifier]);
}

function container(tag: string, role?: string) {
  function ExpoUIContainer({ children, hidden, modifiers, testID }: CommonProps) {
    usePositionedLayout(testID, modifiers);
    return hidden
      ? null
      : React.createElement(tag, { role, 'data-testid': testID }, children);
  }

  return ExpoUIContainer;
}

export const Host = container('div');
export function RNHostView({ children, hidden, modifiers, testID }: CommonProps) {
  usePositionedLayout(testID, modifiers);
  if (hidden) return null;
  const child = React.Children.only(children) as React.ReactElement<{
    pointerEvents?: string;
  }>;
  const renderedChild = child.props.pointerEvents
    ? React.cloneElement(child, { pointerEvents: undefined })
    : child;
  return React.createElement(
    'div',
    {
      'data-child-pointer-events': child.props.pointerEvents,
      'data-testid': testID,
    },
    renderedChild
  );
}
export const Row = container('div');
export const Column = container('div');
export const List = container('div', 'list');
export const ListItem = container('div', 'listitem');
export const Spacer = () => React.createElement('span', { 'aria-hidden': true });

export function Text({ children, testID }: CommonProps) {
  return React.createElement('span', { 'data-testid': testID }, children);
}

const FieldSection = ({ children, hidden, testID, title }: CommonProps & { title?: string }) =>
  hidden
    ? null
    : React.createElement(
        'section',
        { 'data-testid': testID },
        title ? React.createElement('h2', null, title) : null,
        children
      );

const FieldSectionHeader = container('header');
const FieldSectionFooter = container('footer');

export const FieldGroup = Object.assign(container('div'), {
  Section: FieldSection,
  SectionHeader: FieldSectionHeader,
  SectionFooter: FieldSectionFooter,
});

export function Button({
  children,
  disabled,
  hidden,
  label,
  modifiers,
  onPress,
  style,
  testID,
}: CommonProps & {
  disabled?: boolean;
  modifiers?: { $type?: string; eventListener?: () => void }[];
  onPress?: () => void;
  style?: { width?: number | string };
}) {
  if (hidden) return null;
  const modifierPress = modifiers?.find((modifier) => modifier.eventListener)?.eventListener;
  return React.createElement(
    'button',
    {
      disabled,
      onClick: onPress ?? modifierPress,
      'data-modifiers': modifiers?.map((modifier) => modifier.$type).join(','),
      'data-style-width': style?.width,
      'data-testid': testID,
      type: 'button',
    },
    children ?? label
  );
}

export function Switch({
  disabled,
  label,
  onValueChange,
  testID,
  value,
}: {
  disabled?: boolean;
  label?: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
}) {
  return React.createElement(
    'label',
    null,
    label,
    React.createElement('input', {
      'aria-label': label,
      checked: value,
      disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onValueChange(event.currentTarget.checked),
      role: 'switch',
      'data-testid': testID,
      type: 'checkbox',
    })
  );
}

export function Checkbox({
  disabled,
  label,
  onValueChange,
  testID,
  value,
}: {
  disabled?: boolean;
  label?: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
}) {
  return React.createElement('input', {
    'aria-label': label,
    checked: value,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onValueChange(event.currentTarget.checked),
    'data-testid': testID,
    type: 'checkbox',
  });
}

type PickerItemProps = { children?: React.ReactNode; label?: string; value: string };

function PickerItem({ children, label, value }: PickerItemProps) {
  return React.createElement('option', { value }, children ?? label);
}

export const Picker = Object.assign(
  ({
    children,
    disabled,
    label,
    onValueChange,
    testID,
    value,
  }: CommonProps & {
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    value?: string;
  }) =>
    React.createElement(
      'select',
      {
        'aria-label': label,
        disabled,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange?.(event.currentTarget.value),
        'data-testid': testID,
        value,
      },
      children
    ),
  { Item: PickerItem }
);

export function BottomSheet({
  children,
  isPresented,
  onDismiss,
  testID,
}: CommonProps & { isPresented: boolean; onDismiss: () => void }) {
  if (!isPresented) return null;
  return React.createElement(
    'div',
    { role: 'dialog', 'data-testid': testID },
    children,
    React.createElement(
      'button',
      {
        'aria-label': `Dismiss ${testID ?? 'bottom sheet'}`,
        onClick: onDismiss,
        type: 'button',
      },
      'Dismiss'
    )
  );
}
