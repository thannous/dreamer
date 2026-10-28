import { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent, type KeyboardMetrics } from 'react-native';

/**
 * Whether a keyboard React Native reports shown covers part of the window. Folding the
 * iPhone Duo reports one shown with no height, and no hide until it unfolds.
 */
export function keyboardCoversWindow(keyboard: KeyboardMetrics | null | undefined): boolean {
  return (keyboard?.height ?? 0) > 0;
}

/**
 * Whether the software keyboard is up, for layouts that hide or resize chrome
 * around it.
 *
 * On iOS the change lands when the keyboard starts moving (the `Will` events)
 * and the resulting layout follows the keyboard's own duration and curve, so
 * nothing jumps once the keyboard has settled. Views it adds fade in; views it
 * removes leave at once. `Did` events reconcile a screen mounted mid-transition,
 * without scheduling another animation. Android only reports `Did`.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible() && keyboardCoversWindow(Keyboard.metrics()));
  const current = useRef(visible);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const updateVisible = (next: boolean, animation?: KeyboardEvent) => {
      // An event that changes nothing, such as a fold's keyboard of no height or the hide
      // after it, lends no animation to the next layout, which would be another change's.
      if (next === current.current) return;
      current.current = next;
      if (ios && animation && animation.duration > 0) {
        // No `delete` phase: React Native would defer each faded-out removal to a
        // later commit, and Reanimated 4.7's layout animations proxy then miscounts
        // that parent's children (software-mansion/react-native-reanimated#10882).
        // A debug build aborts at the parent's next removal, such as the reload
        // after a sign-in.
        LayoutAnimation.configureNext({
          duration: animation.duration,
          create: { type: LayoutAnimation.Types.keyboard, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setVisible(next);
    };
    // The direction of the iOS transition in progress. A show cut short by a hide
    // can still report `DidShow` after `WillHide`: only the matching `Did` ends it.
    let moving: boolean | null = null;
    const onWill = (shows: boolean) => (event: KeyboardEvent) => {
      moving = shows;
      updateVisible(shows && keyboardCoversWindow(event.endCoordinates), event);
    };
    const onDid = (shows: boolean) => (event: KeyboardEvent) => {
      if (moving !== null && moving !== shows) return;
      moving = null;
      updateVisible(shows && keyboardCoversWindow(event.endCoordinates));
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', onDid(true)),
      Keyboard.addListener('keyboardDidHide', onDid(false)),
    ];
    if (ios) {
      subscriptions.push(
        Keyboard.addListener('keyboardWillShow', onWill(true)),
        Keyboard.addListener('keyboardWillHide', onWill(false)),
      );
    }
    // RN updates this snapshot on DidShow/DidHide. Re-read after subscribing so
    // an event between render and this effect cannot leave stale chrome state.
    updateVisible(Keyboard.isVisible() && keyboardCoversWindow(Keyboard.metrics()));
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  return visible;
}
