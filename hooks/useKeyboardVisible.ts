import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

/**
 * Whether the software keyboard is up, for layouts that hide or resize chrome
 * around it.
 *
 * On iOS the change lands when the keyboard starts moving (the `Will` events)
 * and the resulting layout follows the keyboard's own duration and curve, so
 * nothing jumps once the keyboard has settled. Views it adds fade in; views it
 * removes leave at once. Android only reports `Did`.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onChange = (next: boolean) => (event: KeyboardEvent) => {
      if (ios && event.duration > 0) {
        // No `delete` phase: React Native would defer each faded-out removal to a
        // later commit, and Reanimated 4.7's layout animations proxy then miscounts
        // that parent's children (software-mansion/react-native-reanimated#10882).
        // A debug build aborts at the parent's next removal, such as the reload
        // after a sign-in.
        LayoutAnimation.configureNext({
          duration: event.duration,
          create: { type: LayoutAnimation.Types.keyboard, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.keyboard },
        });
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
