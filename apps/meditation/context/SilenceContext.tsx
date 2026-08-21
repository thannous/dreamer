import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTranslation } from '@/context/LanguageContext';
import { SilenceDelayMs } from '@/constants/motion';
import { TID } from '@/lib/testIDs';

/**
 * ONE silence for a screen.
 *
 * Progressive silence is the interaction signature: after a few seconds without
 * a touch, the chrome withdraws and only the artwork remains. A single touch
 * ANYWHERE brings it back.
 *
 * That last word is why this is a provider rather than per-component state. A
 * screen has several pieces of chrome — a close link at the top, the transport
 * at the bottom — and they must fade and return as one. Held per component,
 * each piece kept its own timer and its own touch catcher sized to its own
 * bounds: the artwork in between woke nothing at all, and a touch on the top
 * strip brought back the close link while the controls stayed hidden. Same
 * reasoning as the breath, which is also driven once for everyone.
 */
type SilenceContextValue = {
  /** False once the chrome has withdrawn. */
  visible: boolean;
  /** Bring the chrome back and restart the delay. */
  wake: () => void;
};

const SilenceContext = createContext<SilenceContextValue | null>(null);

type Props = React.PropsWithChildren<{
  /** Chrome only fades while this is true — e.g. while a session is playing. */
  active?: boolean;
  delayMs?: number;
}>;

export const SilenceProvider: React.FC<Props> = ({
  children,
  active = true,
  delayMs = SilenceDelayMs,
}) => {
  const { t } = useTranslation();
  const [awake, setAwake] = useState(true);

  // Adjusting state during render when a prop changes — the sanctioned pattern.
  // Resuming a session must always bring the chrome back before it fades again.
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    setAwake(true);
  }

  const visible = !active || awake;
  const wake = useCallback(() => setAwake(true), []);

  useEffect(() => {
    if (!active || !awake) return;

    const timer = setTimeout(() => setAwake(false), delayMs);
    return () => clearTimeout(timer);
  }, [active, awake, delayMs]);

  return (
    <SilenceContext.Provider value={{ visible, wake }}>
      <View className="flex-1">
        {children}
        {/* Covers the whole screen, and only exists while the chrome is hidden
            — so the touch that restores the chrome can never also press it.
            Rendered last, above everything, including the artwork. */}
        {!visible ? (
          <Pressable
            testID={TID.Button.RevealControls}
            accessibilityRole="button"
            accessibilityLabel={t('player.reveal')}
            onPress={wake}
            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
          />
        ) : null}
      </View>
    </SilenceContext.Provider>
  );
};

export function useSilence(): SilenceContextValue {
  const value = useContext(SilenceContext);

  if (!value) {
    throw new Error('useSilence must be used inside a SilenceProvider');
  }

  return value;
}
