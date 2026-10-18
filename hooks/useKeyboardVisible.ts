import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

/**
 * Whether the software keyboard is up, for layouts that hide or resize chrome
 * around it.
 *
 * On iOS the change lands when the keyboard starts moving (the `Will` events)
 * and the resulting layout follows the keyboard's own duration and curve, so
 * nothing jumps once the keyboard has settled. Android only reports `Did`.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onChange = (next: boolean) => (event: KeyboardEvent) => {
      if (ios && event.duration > 0) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(event.duration, LayoutAnimation.Types.keyboard, LayoutAnimation.Properties.opacity)
        );
      }
      setVisible(next);
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onChange(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onChange(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
